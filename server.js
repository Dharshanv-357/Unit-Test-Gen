require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
let publicShareUrl = '';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const { generateMockTest } = require('./ai-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and express JSON mapping
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Host static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for processing file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Max limit 10MB
});

/**
 * Text extraction utility matching file types
 */
async function extractText(fileBuffer, mimeType, fileName) {
  const extension = path.extname(fileName).toLowerCase();
  
  if (mimeType === 'text/plain' || extension === '.txt') {
    return fileBuffer.toString('utf8');
  } 
  
  if (mimeType === 'application/pdf' || extension === '.pdf') {
    const pdfModule = require('pdf-parse');
    let text = '';
    
    if (typeof pdfModule === 'function') {
      const parsedPdf = await pdfModule(fileBuffer);
      text = parsedPdf.text;
    } else if (pdfModule && typeof pdfModule.PDFParse === 'function') {
      const parser = new pdfModule.PDFParse({ data: fileBuffer });
      const parsed = await parser.getText();
      text = parsed.text;
    } else {
      throw new Error('Unsupported or unknown export structure in the pdf-parse library.');
    }
    
    return text;
  } 
  
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
    extension === '.docx'
  ) {
    const parsedDocx = await mammoth.extractRawText({ buffer: fileBuffer });
    return parsedDocx.value;
  }
  
  throw new Error(`Unsupported document extension or format: ${extension} / ${mimeType}`);
}

// Auth setup
const activeSessions = new Set();
const TEACHER_USERNAME = process.env.TEACHER_USERNAME || 'admin';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'admin123';

/**
 * Authentication Middleware
 */
function authenticateTeacher(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const token = authHeader.substring(7);
  if (!activeSessions.has(token)) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
  next();
}

/**
 * API Endpoint: Teacher Login
 */
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (username === TEACHER_USERNAME && password === TEACHER_PASSWORD) {
    const token = require('crypto').randomBytes(24).toString('hex');
    activeSessions.add(token);
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid username or password.' });
});

/**
 * API Endpoint: Preflight content checks
 */
app.post('/api/v1/preflight', authenticateTeacher, (req, res) => {
  const { rawText } = req.body;
  if (!rawText || rawText.trim().length === 0) {
    return res.status(400).json({ safe: false, reason: 'Source material text is completely empty.' });
  }

  const length = rawText.trim().length;
  if (length > 80000) {
    return res.json({ 
      safe: false, 
      reason: `Text is extremely long (${length} characters). Please reduce length below 80,000 characters for optimal results.` 
    });
  }

  // Simple local profanity/abuse pre-flight check
  const sensitiveWords = ['hack school system', 'bomb building instructions', 'steal credit cards'];
  const lowercaseText = rawText.toLowerCase();
  for (const word of sensitiveWords) {
    if (lowercaseText.includes(word)) {
      return res.json({ safe: false, reason: 'Document failed preflight safety check: unsafe topics detected.' });
    }
  }

  return res.json({ safe: true, reason: null });
});

/**
 * API Endpoint: Mock Test Generator
 */
app.post('/api/v1/generate', authenticateTeacher, upload.single('file'), async (req, res) => {
  try {
    let sourceText = '';
    
    // Extract text from file upload if present, otherwise fallback to pasted plain text
    if (req.file) {
      console.log(`[Server] Uploaded file received: ${req.file.originalname} (${req.file.mimetype})`);
      sourceText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } else if (req.body.rawText) {
      console.log(`[Server] Raw text string received directly.`);
      sourceText = req.body.rawText;
    }

    if (!sourceText || sourceText.trim().length < 20) {
      return res.status(400).json({ 
        error: 'Insufficient source text context. Please upload a file or paste at least 20 characters of learning content.' 
      });
    }

    // Capture parameters from request
    const title = req.body.title || 'Syllabus Assessment';
    const difficulty = req.body.difficultyProfile || 'Mixed';
    const customInstructions = req.body.customInstructions || '';

    // Parse distribution matrix
    let distribution = { multipleChoice: 5, trueFalse: 3, shortAnswer: 2, problemSolving: 1 };
    if (req.body.distribution) {
      try {
        distribution = typeof req.body.distribution === 'string' 
          ? JSON.parse(req.body.distribution) 
          : req.body.distribution;
      } catch (err) {
        console.warn('[Server] Error parsing custom distribution, using defaults.', err);
      }
    }

    console.log(`[Server] Processing Exam Request: "${title}" - Diff: ${difficulty} - Params:`, distribution);

    // Call generating pipeline
    const generatedTest = await generateMockTest(
      sourceText, 
      title, 
      difficulty, 
      distribution, 
      customInstructions
    );

    // Overwrite metadata from preflight configurations if supplied
    if (req.body.duration) {
      generatedTest.examMetadata.estimatedDurationMinutes = parseInt(req.body.duration) || 45;
    }
    if (req.body.instructions) {
      generatedTest.examMetadata.instructions = req.body.instructions;
    }

    return res.json(generatedTest);
  } catch (err) {
    console.error('[Server] Critical Generation Pipeline Error:', err);
    return res.status(500).json({ 
      error: 'An internal error occurred during text parsing or model extraction: ' + err.message 
    });
  }
});

// Create share folder path on startup
const shareDir = path.join(__dirname, 'shares');
if (!fs.existsSync(shareDir)) {
  fs.mkdirSync(shareDir, { recursive: true });
}
const submissionsDir = path.join(shareDir, 'submissions');
if (!fs.existsSync(submissionsDir)) {
  fs.mkdirSync(submissionsDir, { recursive: true });
}

// Local network LAN IP resolution
const os = require('os');
app.get('/api/v1/server-ip', authenticateTeacher, (req, res) => {
  const interfaces = os.networkInterfaces();
  let candidates = [];
  
  for (const devName in interfaces) {
    const devLower = devName.toLowerCase();
    // Skip virtual adapters
    if (
      devLower.includes('virtualbox') || 
      devLower.includes('vbox') || 
      devLower.includes('vmware') || 
      devLower.includes('wsl') || 
      devLower.includes('docker') || 
      devLower.includes('vethernet') ||
      devLower.includes('loopback')
    ) {
      continue;
    }
    
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        candidates.push({
          name: devName,
          address: alias.address
        });
      }
    }
  }
  
  // Sort: prioritize actual Wi-Fi / wlan / wireless interfaces, then physical Ethernet / eth
  candidates.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    
    const isWiFiA = nameA.includes('wi-fi') || nameA.includes('wireless') || nameA.includes('wlan');
    const isWiFiB = nameB.includes('wi-fi') || nameB.includes('wireless') || nameB.includes('wlan');
    
    const isEthA = nameA.includes('ethernet') || nameA.includes('eth');
    const isEthB = nameB.includes('ethernet') || nameB.includes('eth');
    
    if (isWiFiA && !isWiFiB) return -1;
    if (!isWiFiA && isWiFiB) return 1;
    if (isEthA && !isEthB) return -1;
    if (!isEthA && isEthB) return 1;
    return 0;
  });
  
  let localIp = 'localhost';
  if (candidates.length > 0) {
    localIp = candidates[0].address;
  } else {
    // Fallback: check everything if candidates list is empty
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          localIp = alias.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }
  }
  
  return res.json({ 
    lanUrl: `http://${localIp}:${PORT}`,
    publicUrl: publicShareUrl || `http://${localIp}:${PORT}`
  });
});

/**
 * API Endpoint: Save a student quiz submission
 */
app.post('/api/v1/share/:id/submit', (req, res) => {
  try {
    const shareId = req.params.id;
    const testFilePath = path.join(shareDir, `${shareId}.json`);
    if (!fs.existsSync(testFilePath)) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    const submission = req.body;
    if (!submission || !submission.candidateName) {
      return res.status(400).json({ error: 'Invalid submission data.' });
    }

    const subFilePath = path.join(submissionsDir, `${shareId}.json`);
    let submissions = [];
    if (fs.existsSync(subFilePath)) {
      try {
        submissions = JSON.parse(fs.readFileSync(subFilePath, 'utf8'));
      } catch (e) {
        submissions = [];
      }
    }

    // Add unique submission data
    submissions.push({
      id: require('crypto').randomBytes(4).toString('hex'),
      candidateName: submission.candidateName,
      rollNumber: submission.rollNumber || 'N/A',
      date: submission.date || new Date().toISOString().substring(0, 10),
      score: Number(submission.score) || 0,
      totalPoints: Number(submission.totalPoints) || 0,
      percentage: Number(submission.percentage) || 0,
      timestamp: new Date().toISOString(),
      answers: Array.isArray(submission.answers) ? submission.answers : []
    });

    fs.writeFileSync(subFilePath, JSON.stringify(submissions, null, 2), 'utf8');
    console.log(`[Server] New student submission saved for exam: ${shareId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Server] Failed to save submission:', err);
    return res.status(500).json({ error: 'Failed to record student submission: ' + err.message });
  }
});

/**
 * API Endpoint: Retrieve all student quiz submissions for a shared exam
 */
app.get('/api/v1/share/:id/submissions', authenticateTeacher, (req, res) => {
  try {
    const shareId = req.params.id;
    const subFilePath = path.join(submissionsDir, `${shareId}.json`);
    
    let submissions = [];
    if (fs.existsSync(subFilePath)) {
      submissions = JSON.parse(fs.readFileSync(subFilePath, 'utf8'));
    }
    
    return res.json(submissions);
  } catch (err) {
    console.error('[Server] Failed to load submissions:', err);
    return res.status(500).json({ error: 'Failed to load quiz submissions: ' + err.message });
  }
});

/**
 * API Endpoint: Save test and create a share link
 */
app.post('/api/v1/share', authenticateTeacher, (req, res) => {
  try {
    const testData = req.body;
    if (!testData || !testData.examMetadata) {
      return res.status(400).json({ error: 'Invalid test configuration payload.' });
    }
    
    // Generate a secure 16-character hexadecimal ID
    const shareId = require('crypto').randomBytes(8).toString('hex');
    const filePath = path.join(shareDir, `${shareId}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2), 'utf8');
    console.log(`[Server] Exam shared successfully. ID: ${shareId}`);
    
    return res.json({ shareId });
  } catch (err) {
    console.error('[Server] Failed to save share link:', err);
    return res.status(500).json({ error: 'Failed to generate share URL: ' + err.message });
  }
});

/**
 * API Endpoint: Retrieve a shared test configuration
 */
app.get('/api/v1/share/:id', (req, res) => {
  try {
    const shareId = req.params.id;
    const filePath = path.join(shareDir, `${shareId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock test paper not found. It may have expired or been deleted.' });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return res.json(JSON.parse(fileContent));
  } catch (err) {
    console.error('[Server] Failed to retrieve share link:', err);
    return res.status(500).json({ error: 'Failed to load shared exam: ' + err.message });
  }
});

/**
 * API Endpoint: Retrieve list of all previously shared exams (History)
 */
app.get('/api/v1/history', authenticateTeacher, (req, res) => {
  try {
    if (!fs.existsSync(shareDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(shareDir);
    const historyList = [];

    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.json') {
        const filePath = path.join(shareDir, file);
        
        // Ensure it is a file and not a subdirectory
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const examData = JSON.parse(fileContent);

          if (examData && examData.examMetadata) {
            const shareId = path.basename(file, '.json');
            historyList.push({
              shareId: shareId,
              title: examData.examMetadata.title || 'Untitled Exam',
              generatedDate: examData.examMetadata.generatedDate || stat.mtime.toISOString(),
              estimatedDurationMinutes: examData.examMetadata.estimatedDurationMinutes || 45,
              difficultyProfile: examData.examMetadata.difficultyProfile || 'Mixed',
              totalPoints: examData.examMetadata.totalPoints || 0
            });
          }
        } catch (parseErr) {
          console.warn(`[Server] Skip corrupt file ${file}:`, parseErr.message);
        }
      }
    }

    // Sort by generatedDate descending
    historyList.sort((a, b) => new Date(b.generatedDate) - new Date(a.generatedDate));

    return res.json(historyList);
  } catch (err) {
    console.error('[Server] Failed to load history:', err);
    return res.status(500).json({ error: 'Failed to retrieve exam history: ' + err.message });
  }
});

/**
 * API Endpoint: Delete a shared exam and its submissions from history
 */
app.delete('/api/v1/share/:id', authenticateTeacher, (req, res) => {
  try {
    const shareId = req.params.id;
    // Validate id format (16-char hex)
    if (!/^[a-f0-9]{16}$/.test(shareId)) {
      return res.status(400).json({ error: 'Invalid share ID format.' });
    }

    const shareFilePath = path.join(shareDir, `${shareId}.json`);
    const subFilePath   = path.join(submissionsDir, `${shareId}.json`);

    if (!fs.existsSync(shareFilePath)) {
      return res.status(404).json({ error: 'Exam not found in history.' });
    }

    // Delete share file
    fs.unlinkSync(shareFilePath);

    // Delete submissions file if it exists
    if (fs.existsSync(subFilePath)) {
      fs.unlinkSync(subFilePath);
    }

    console.log(`[Server] Exam ${shareId} deleted from history.`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Server] Failed to delete exam:', err);
    return res.status(500).json({ error: 'Failed to delete exam: ' + err.message });
  }
});

// Launch server instance
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  AI Mock Test Generator running on http://localhost:${PORT}`);
  console.log(`=======================================================`);
  startPublicTunnel();
});

function startPublicTunnel() {
  const { exec } = require('child_process');
  console.log(`[Tunnel] Initiating public secure tunnel on port ${PORT} using localhost.run...`);
  
  // Connect to localhost.run keylessly via SSH using 127.0.0.1 (avoids IPv6 binding issues)
  const sshCmd = `ssh -o StrictHostKeyChecking=no -R 80:127.0.0.1:${PORT} localhost.run`;
  const tunnelProcess = exec(sshCmd, (err, stdout, stderr) => {
    if (err) {
      console.error('[Tunnel] SSH process exited with error:', err);
    }
  });

  tunnelProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Tunnel] Output: ${output.trim()}`);
    // Match the generated HTTPS URL from localhost.run output
    const match = output.match(/(https:\/\/[a-z0-9.-]+\.lhr\.life)/i);
    if (match) {
      publicShareUrl = match[1];
      console.log(`=======================================================`);
      console.log(`  PUBLIC GLOBAL SHARING URL ACTIVE: ${publicShareUrl}`);
      console.log(`=======================================================`);
    }
  });

  tunnelProcess.stderr.on('data', (data) => {
    console.warn(`[Tunnel] Warning: ${data.toString().trim()}`);
  });

  // Keep tunnel alive or restart if it dies
  tunnelProcess.on('close', (code) => {
    console.log(`[Tunnel] Connection closed with code ${code}. Retrying in 10s...`);
    setTimeout(startPublicTunnel, 10000);
  });
}
