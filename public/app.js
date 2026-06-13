/**
 * AetherTest AI: Client-Side Dashboard Controller & State Manager
 */

// Global State
window.activeExamState = null;
let uploadedFile = null;
let loaderInterval = null;

// DOM Elements - Wizard Screens
const stepConfigStudio = document.getElementById('step-config-studio');
const stepLoadingChamber = document.getElementById('step-loading-chamber');
const stepExamWorkbench = document.getElementById('step-exam-workbench');

// DOM Elements - Header & Sidebar Inputs
const bodyEl = document.body;
const themeToggleBtn = document.getElementById('theme-toggle');
const logoutBtn = document.getElementById('logout-btn');
const historyTriggerBtn = document.getElementById('history-trigger-btn');
const historyMenu = document.getElementById('history-menu');
const rawTextArea = document.getElementById('rawText');
const charCountSpan = document.getElementById('char-count');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('upload-status');
const generatorForm = document.getElementById('generator-form');
const generateBtn = document.getElementById('generate-btn');

// DOM Elements - Workbench Actions & Canvas
const btnBackToStudio = document.getElementById('btn-back-to-studio');
const viewStudentBtn = document.getElementById('view-student');
const viewTeacherBtn = document.getElementById('view-teacher');
const viewSubmissionsBtn = document.getElementById('view-submissions');
const btnShareExam = document.getElementById('btn-share-exam');
const exportPdfBtn = document.getElementById('export-pdf');
const exportDataBtn = document.getElementById('export-data');
const exportMenu = document.querySelector('.export-menu');
const btnExportJson = document.getElementById('btn-export-json');
const btnExportCsv = document.getElementById('btn-export-csv');
const testCanvas = document.getElementById('test-canvas');
const submissionsCanvas = document.getElementById('submissions-canvas');
const btnRefreshSubmissions = document.getElementById('btn-refresh-submissions');
const btnReviewExam = document.getElementById('btn-review-exam');

// DOM Elements - Render Paper Target Points
const paperTitle = document.getElementById('paper-title');
const paperDate = document.getElementById('paper-date');
const paperDuration = document.getElementById('paper-duration');
const paperPoints = document.getElementById('paper-points');
const paperDiff = document.getElementById('paper-diff');
const paperInstructions = document.getElementById('paper-general-instructions');
const sectionsHolder = document.getElementById('exam-sections-holder');
const marksTotalBadge = document.getElementById('marks-total-badge');

// DOM Elements - Sharing Modal
const shareModal = document.getElementById('share-modal');
const btnCloseShare = document.getElementById('btn-close-share');
const shareUrlInput = document.getElementById('share-url-input');
const btnCopyUrl = document.getElementById('btn-copy-url');
const shareUrlLanInput = document.getElementById('share-url-lan-input');
const btnCopyLanUrl = document.getElementById('btn-copy-lan-url');
const shareQrImage = document.getElementById('share-qr-image');

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupTextareaCounter();
  setupDragAndDrop();
  setupExportDropdown();
  
  // Exam History System
  initHistory();

  // Logout Control
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('teacher_token');
      window.location.href = '/login.html';
    });
  }

  // Form Submission
  generatorForm.addEventListener('submit', handleFormSubmit);

  // Wizard Redirection Loops
  btnBackToStudio.addEventListener('click', returnToStudio);

  // Toggle Preview Modes
  viewStudentBtn.addEventListener('click', () => setPreviewMode('student'));
  viewTeacherBtn.addEventListener('click', () => setPreviewMode('teacher'));
  viewSubmissionsBtn.addEventListener('click', () => setPreviewMode('submissions'));
  btnRefreshSubmissions.addEventListener('click', fetchSubmissions);
  if (btnReviewExam) btnReviewExam.addEventListener('click', () => setPreviewMode('student'));

  // Export File Calls
  exportPdfBtn.addEventListener('click', () => window.print());
  btnExportJson.addEventListener('click', downloadJSON);
  btnExportCsv.addEventListener('click', downloadCSV);

  // Share Dialog Wires
  btnShareExam.addEventListener('click', openShareModal);
  btnCloseShare.addEventListener('click', closeShareModal);
  btnCopyUrl.addEventListener('click', copyShareURL);
  btnCopyLanUrl.addEventListener('click', copyShareLanURL);
  
  // Close share modal if backdrop is clicked
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) closeShareModal();
  });

  // Enable inline editing sync to metadata
  paperTitle.addEventListener('blur', () => {
    if (window.activeExamState) window.activeExamState.examMetadata.title = paperTitle.innerText;
  });
  paperDuration.addEventListener('blur', () => {
    if (window.activeExamState) {
      window.activeExamState.examMetadata.estimatedDurationMinutes = parseInt(paperDuration.innerText) || 45;
    }
  });
});

/* ==========================================================================
   Theme & Visual System Helpers
   ========================================================================== */

function setupTheme() {
  themeToggleBtn.addEventListener('click', () => {
    bodyEl.classList.toggle('light-theme');
    bodyEl.classList.toggle('dark-theme');
    const isLight = bodyEl.classList.contains('light-theme');
    localStorage.setItem('aethertest-theme', isLight ? 'light' : 'dark');
  });

  // Hydrate local storage preference
  const savedTheme = localStorage.getItem('aethertest-theme');
  if (savedTheme === 'light') {
    bodyEl.classList.add('light-theme');
    bodyEl.classList.remove('dark-theme');
  }
}

function setupTextareaCounter() {
  rawTextArea.addEventListener('input', () => {
    const len = rawTextArea.value.length;
    charCountSpan.textContent = len.toLocaleString();
    if (len > 40000) {
      charCountSpan.style.color = 'var(--color-danger)';
    } else {
      charCountSpan.style.color = 'var(--text-muted)';
    }
  });
}

/* ==========================================================================
   Document Parser Dropzone Handlers
   ========================================================================== */

function setupDragAndDrop() {
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });
}

function handleFileSelected(file) {
  const allowedExtensions = ['.txt', '.pdf', '.docx'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    alert('Invalid document format. Please upload a .txt, .pdf, or .docx file.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('File size exceeds the 10MB limit. Please upload a smaller document.');
    return;
  }

  uploadedFile = file;
  uploadStatus.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  uploadStatus.classList.remove('hide');
  
  if (!rawTextArea.value.trim()) {
    rawTextArea.value = `[File attached: ${file.name}. Click Generate to extract and create the test.]`;
    charCountSpan.textContent = rawTextArea.value.length;
  }
}

/* ==========================================================================
   Exam History System & Data Restore
   ========================================================================== */

function initHistory() {
  if (!historyTriggerBtn || !historyMenu) return;

  // Toggle dropdown on button click
  historyTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = historyMenu.classList.contains('hide');
    
    // Close other dropdowns if open
    if (exportMenu) exportMenu.classList.add('hide');
    
    if (isHidden) {
      fetchHistoryList();
      historyMenu.classList.remove('hide');
    } else {
      historyMenu.classList.add('hide');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!historyMenu.contains(e.target) && e.target !== historyTriggerBtn && !historyTriggerBtn.contains(e.target)) {
      historyMenu.classList.add('hide');
    }
  });
}

async function fetchHistoryList() {
  historyMenu.innerHTML = `
    <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
      <div class="btn-spinner" style="margin: 0 auto 8px auto;"></div>
      Loading history...
    </div>
  `;

  try {
    const res = await fetch('/api/v1/history');
    if (!res.ok) throw new Error("Could not retrieve generated exams.");

    const history = await res.json();
    if (history.length === 0) {
      historyMenu.innerHTML = `
        <div class="history-empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          No generated exams found in history.
        </div>
      `;
      return;
    }

    historyMenu.innerHTML = '';
    history.forEach(item => {
      const dateStr = new Date(item.generatedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const row = document.createElement('div');
      row.className = 'history-item';

      // Clickable content section
      const contentBtn = document.createElement('button');
      contentBtn.className = 'history-item-content';
      contentBtn.innerHTML = `
        <div class="history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="history-meta">
          <span>${dateStr}</span>
          <span class="history-badge">${item.totalPoints} pts &bull; ${item.difficultyProfile}</span>
        </div>
      `;
      contentBtn.addEventListener('click', () => {
        historyMenu.classList.add('hide');
        loadHistoryExam(item.shareId);
      });

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-history-delete';
      delBtn.title = 'Delete this exam from history';
      delBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${item.title}" from history? This cannot be undone.`)) {
          await deleteHistoryExam(item.shareId, row);
        }
      });

      row.appendChild(contentBtn);
      row.appendChild(delBtn);
      historyMenu.appendChild(row);
    });

  } catch (err) {
    console.error("Failed to load history list:", err);
    historyMenu.innerHTML = `
      <div class="history-empty-state" style="color: var(--color-danger);">
        Failed to load exam history list.
      </div>
    `;
  }
}

async function deleteHistoryExam(shareId, rowEl) {
  try {
    // Animate removal
    rowEl.style.opacity = '0.4';
    rowEl.style.pointerEvents = 'none';

    const res = await fetch(`/api/v1/share/${shareId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Delete failed');
    }

    // Remove from DOM with smooth animation
    rowEl.style.transition = 'all 0.3s ease';
    rowEl.style.maxHeight = rowEl.offsetHeight + 'px';
    requestAnimationFrame(() => {
      rowEl.style.maxHeight = '0';
      rowEl.style.opacity = '0';
      rowEl.style.overflow = 'hidden';
    });
    setTimeout(() => {
      rowEl.remove();
      // If no items left, show empty state
      const remaining = historyMenu.querySelectorAll('.history-item');
      if (remaining.length === 0) {
        historyMenu.innerHTML = `
          <div class="history-empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            No generated exams found in history.
          </div>
        `;
      }
    }, 320);

    // If the deleted exam is the currently open one, return to studio
    if (window.activeExamState && window.activeExamState.shareId === shareId) {
      window.activeExamState = null;
      historyMenu.classList.add('hide');
      returnToStudio();
    }

    console.log(`[App] Exam ${shareId} deleted from history.`);
  } catch (err) {
    console.error('Failed to delete exam:', err);
    rowEl.style.opacity = '1';
    rowEl.style.pointerEvents = '';
    alert('Failed to delete exam: ' + err.message);
  }
}

async function loadHistoryExam(shareId) {
  try {
    // Show premium loader screen while fetching
    stepConfigStudio.classList.add('hide');
    stepLoadingChamber.classList.remove('hide');
    
    // Clear and start load milestones quickly
    stopAssemblyMilestones();
    const loaderTitle = document.getElementById('loader-title');
    const loaderSubtitle = document.getElementById('loader-subtitle');
    if (loaderTitle) loaderTitle.textContent = "Retrieving Exam State";
    if (loaderSubtitle) loaderSubtitle.textContent = "Retrieving metadata and submissions logs...";

    const res = await fetch(`/api/v1/share/${shareId}`);
    if (!res.ok) throw new Error("Could not load the selected examination.");

    const examData = await res.json();
    
    // Inject shareId since history retrieves a file, but the active exam needs to know its shareId for submissions
    examData.shareId = shareId;
    window.activeExamState = examData;

    // Render it in the workspace
    renderExam();

    // Hide loader and display the workbench
    stepLoadingChamber.classList.add('hide');
    stepExamWorkbench.classList.remove('hide');

    // Switch preview tab to Submissions Dashboard directly and fetch submissions immediately!
    setPreviewMode('submissions');
    
    console.log(`[App] Exam ${shareId} successfully loaded from history database.`);
  } catch (err) {
    console.error("Error loading historical exam:", err);
    alert("Failed to load historical exam: " + err.message);
    returnToStudio();
  }
}

/* ==========================================================================
   Load Sample Data File
   ========================================================================== */

async function loadSampleData(e) {
  e.preventDefault();
  try {
    const response = await fetch('/sample-evolution.txt');
    if (!response.ok) throw new Error('Could not retrieve sample textbook.');
    
    const sampleText = await response.text();
    rawTextArea.value = sampleText;
    charCountSpan.textContent = sampleText.length.toLocaleString();
    
    uploadedFile = null;
    uploadStatus.classList.add('hide');
    fileInput.value = '';

    rawTextArea.focus();
  } catch (err) {
    console.error(err);
    alert('Failed to retrieve mock biology textbook: ' + err.message);
  }
}

/* ==========================================================================
   Step-by-Step Wizard Generation & Redirection Loops
   ========================================================================== */

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const hasText = rawTextArea.value.trim().length > 0;
  if (!hasText && !uploadedFile) {
    alert('Please paste some content notes or attach a file to generate the test.');
    return;
  }

  // Phase 1: Redirect immediately to Assembly Loading Chamber
  stepConfigStudio.classList.add('hide');
  stepLoadingChamber.classList.remove('hide');
  startAssemblyMilestones();

  try {
    const formData = new FormData();
    if (uploadedFile) {
      formData.append('file', uploadedFile);
    }
    
    formData.append('rawText', rawTextArea.value);
    formData.append('title', document.getElementById('examTitle').value || 'Aether Assessment Exam');
    formData.append('difficultyProfile', document.getElementById('difficultyProfile').value);
    formData.append('customInstructions', document.getElementById('customInstructions').value);
    formData.append('duration', document.getElementById('examDuration').value || '45');
    formData.append('instructions', document.getElementById('examInstructionsInput').value || 'Read all instructions carefully.');

    const dist = {
      multipleChoice: parseInt(document.getElementById('count-mc').value) || 0,
      trueFalse: parseInt(document.getElementById('count-tf').value) || 0,
      shortAnswer: parseInt(document.getElementById('count-sa').value) || 0,
      problemSolving: parseInt(document.getElementById('count-ps').value) || 0
    };
    formData.append('distribution', JSON.stringify(dist));

    // Call Preflight safety pre-check
    if (!uploadedFile) {
      const preflightRes = await fetch('/api/v1/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextArea.value })
      });
      const preflightData = await preflightRes.json();
      if (!preflightData.safe) {
        alert(preflightData.reason);
        returnToStudio();
        return;
      }
    }

    // Call main generation endpoint
    const response = await fetch('/api/v1/generate', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Server encountered an error compiling questions.');
    }

    const testObject = await response.json();
    console.log('[App] Successfully compiled test schema:', testObject);
    
    // Complete the final milestone and redirect
    stopAssemblyMilestones();
    window.activeExamState = testObject;
    
    // Transition to step 3 (Workbench)
    stepLoadingChamber.classList.add('hide');
    stepExamWorkbench.classList.remove('hide');
    
    renderExam();
    
  } catch (err) {
    console.error(err);
    alert('Pipeline Error: ' + err.message);
    returnToStudio();
  }
}

function returnToStudio() {
  stopAssemblyMilestones();
  stepExamWorkbench.classList.add('hide');
  stepLoadingChamber.classList.add('hide');
  stepConfigStudio.classList.remove('hide');
}

/**
 * Sequential Loading Chamber Status Indicators
 */
function startAssemblyMilestones() {
  const milestones = [
    { id: 'ms-1', delay: 0 },
    { id: 'ms-2', delay: 1800 },
    { id: 'ms-3', delay: 3600 },
    { id: 'ms-4', delay: 5500 },
    { id: 'ms-5', delay: 7500 }
  ];

  // Reset all
  milestones.forEach(m => {
    const el = document.getElementById(m.id);
    el.className = 'milestone-row';
  });

  // Start sequential activation triggers
  milestones.forEach(m => {
    m.timer = setTimeout(() => {
      // Mark prior as done
      milestones.forEach(prev => {
        if (prev.delay < m.delay) {
          document.getElementById(prev.id).className = 'milestone-row done';
        }
      });
      document.getElementById(m.id).className = 'milestone-row active';
    }, m.delay);
  });

  // Store in global window namespace to clear if needed
  window.assemblyTimers = milestones.map(m => m.timer);
}

function stopAssemblyMilestones() {
  if (window.assemblyTimers) {
    window.assemblyTimers.forEach(t => clearTimeout(t));
    window.assemblyTimers = null;
  }
}

/* ==========================================================================
   Exam Renderer Engine
   ========================================================================== */

function renderExam() {
  if (!window.activeExamState) return;

  const meta = window.activeExamState.examMetadata;
  
  // Render Cover Block
  paperTitle.innerText = meta.title;
  paperDuration.innerText = meta.estimatedDurationMinutes;
  paperPoints.innerText = meta.totalPoints;
  if (marksTotalBadge) marksTotalBadge.innerText = meta.totalPoints;
  if (paperDiff) paperDiff.innerText = meta.difficultyProfile;

  const previewMarksTotalBadge = document.getElementById('preview-marks-total-badge');
  if (previewMarksTotalBadge) previewMarksTotalBadge.innerText = meta.totalPoints;

  if (paperInstructions && meta.instructions) {
    paperInstructions.innerText = meta.instructions;
  }

  paperDate.innerText = new Date(meta.generatedDate || Date.now()).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  sectionsHolder.innerHTML = '';

  // Draw Sections
  window.activeExamState.sections.forEach((section, sIdx) => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'exam-section-wrapper';
    
    sectionEl.innerHTML = `
      <div class="section-hdr-container">
        <h3>${section.sectionTitle}</h3>
        <p class="section-instructions">${section.instructions}</p>
      </div>
      <div class="questions-list-wrapper"></div>
    `;

    const qListWrapper = sectionEl.querySelector('.questions-list-wrapper');

    // Draw Questions
    section.questions.forEach((q, qIdx) => {
      const qCard = document.createElement('div');
      qCard.className = `question-item-card`;
      qCard.dataset.sidx = sIdx;
      qCard.dataset.qidx = qIdx;

      let choicesMarkup = '';
      if (q.questionType === 'multiple-choice' || q.questionType === 'true-false') {
        const tfClass = q.questionType === 'true-false' ? 'tf-options' : '';
        choicesMarkup = `<div class="options-stack ${tfClass}">`;
        
        q.options.forEach((opt, oIdx) => {
          const isCorrectClass = q.correctAnswer === opt.key ? 'is-correct' : '';
          choicesMarkup += `
            <div class="option-node interactive-correct-selector ${isCorrectClass}" data-sidx="${sIdx}" data-qidx="${qIdx}" data-optkey="${opt.key}" title="Click to set this as the correct answer bubble">
              <span class="opt-badge">${opt.key}</span>
              <span class="opt-text" contenteditable="true" data-sidx="${sIdx}" data-qidx="${qIdx}" data-oidx="${oIdx}">${opt.text}</span>
              ${q.questionType === 'multiple-choice' && q.options.length > 2 ? `
                <button class="btn-del-choice" data-sidx="${sIdx}" data-qidx="${qIdx}" data-oidx="${oIdx}" title="Delete option choice">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : ''}
            </div>
          `;
        });
        choicesMarkup += `</div>`;

        // Choice adder option controls row
        if (q.questionType === 'multiple-choice' && q.options.length < 6) {
          choicesMarkup += `
            <div class="choice-controls-row">
              <button class="btn-add-choice" data-sidx="${sIdx}" data-qidx="${qIdx}">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Option Choice
              </button>
            </div>
          `;
        }
      } else {
        choicesMarkup = `
          <div class="student-essay-blank">
            <span class="blank-watermark">[Candidates: Write your comprehensive analytical answer inside this boundary]</span>
          </div>
        `;
      }

      // Rubrics / Explanations
      let keyDrawerMarkup = '';
      if (q.questionType === 'multiple-choice' || q.questionType === 'true-false') {
        keyDrawerMarkup = `
          <div class="master-key-drawer">
            <h4>Pedagogical Explanation (Click to edit text)</h4>
            <div class="ans-badge">Correct Answer: Key ${q.correctAnswer}</div>
            <p class="drawer-text editable-explanation" contenteditable="true" data-sidx="${sIdx}" data-qidx="${qIdx}">${q.explanation}</p>
          </div>
        `;
      } else {
        let rubricItems = '';
        if (q.rubric && q.rubric.length > 0) {
          rubricItems = `<div class="rubric-list">`;
          q.rubric.forEach(step => {
            rubricItems += `
              <div class="rubric-item">
                <span class="drawer-text">${step.step}</span>
                <strong>+${step.pointsAllocated} pts</strong>
              </div>
            `;
          });
          rubricItems += `</div>`;
        }

        keyDrawerMarkup = `
          <div class="master-key-drawer">
            <h4>Expected Solution Outline &amp; Rubrics (Click to edit text)</h4>
            <p class="drawer-text" style="font-weight:600; margin-bottom:8px;">${q.correctAnswer}</p>
            <p class="drawer-text editable-explanation" contenteditable="true" data-sidx="${sIdx}" data-qidx="${qIdx}">${q.explanation}</p>
            <div class="sub-divider"></div>
            <h4>Partial Credit Allocation</h4>
            ${rubricItems || '<p class="drawer-text">None structured.</p>'}
          </div>
        `;
      }

      // Assemble card
      qCard.innerHTML = `
        <div class="question-controls">
          <button class="ctrl-btn btn-points" title="Adjust Points Value" data-sidx="${sIdx}" data-qidx="${qIdx}">
            <strong>${q.points}p</strong>
          </button>
          <button class="ctrl-btn btn-delete" title="Delete Question" data-sidx="${sIdx}" data-qidx="${qIdx}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        <div class="q-title-row">
          <span class="q-number">${q.questionNumber}</span>
          <div class="q-prompt-text" contenteditable="true" data-sidx="${sIdx}" data-qidx="${qIdx}">${q.prompt}</div>
          <span class="q-marks-tag">[${q.points} Marks]</span>
        </div>
        ${choicesMarkup}
        ${keyDrawerMarkup}
      `;

      qListWrapper.appendChild(qCard);
    });

    // Appending a section Question Adder at the bottom of the section questions list
    const sectionActionRow = document.createElement('div');
    sectionActionRow.className = 'section-actions-row';
    sectionActionRow.innerHTML = `
      <button class="btn-add-question" data-sidx="${sIdx}">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add Custom Question to Section
      </button>
    `;
    sectionEl.appendChild(sectionActionRow);
    sectionsHolder.appendChild(sectionEl);
  });

  bindInteractiveCanvasEvents();
}

/* ==========================================================================
   Interactive Editing & State Bindings (Live Canvas)
   ========================================================================== */

function bindInteractiveCanvasEvents() {
  // Sync prompt editing back to model state
  document.querySelectorAll('.q-prompt-text').forEach(promptEl => {
    promptEl.addEventListener('blur', (e) => {
      const sIdx = parseInt(e.target.dataset.sidx);
      const qIdx = parseInt(e.target.dataset.qidx);
      const newPrompt = e.target.innerText;
      if (window.activeExamState) {
        window.activeExamState.sections[sIdx].questions[qIdx].prompt = newPrompt;
      }
    });
  });

  // Sync choice editing back to model state
  document.querySelectorAll('.opt-text').forEach(optEl => {
    optEl.addEventListener('blur', (e) => {
      const sIdx = parseInt(e.target.dataset.sidx);
      const qIdx = parseInt(e.target.dataset.qidx);
      const oIdx = parseInt(e.target.dataset.oidx);
      const newText = e.target.innerText;
      if (window.activeExamState) {
        window.activeExamState.sections[sIdx].questions[qIdx].options[oIdx].text = newText;
      }
    });
  });

  // Sync explanation editing back to model state
  document.querySelectorAll('.editable-explanation').forEach(explainEl => {
    explainEl.addEventListener('blur', (e) => {
      const sIdx = parseInt(e.target.dataset.sidx);
      const qIdx = parseInt(e.target.dataset.qidx);
      const newText = e.target.innerText;
      if (window.activeExamState) {
        window.activeExamState.sections[sIdx].questions[qIdx].explanation = newText;
      }
    });
  });

  // Choice Correct Answer selector bubble toggle
  document.querySelectorAll('.interactive-correct-selector').forEach(node => {
    node.addEventListener('click', (e) => {
      if (e.target.classList.contains('opt-text') || e.target.closest('.btn-del-choice')) return;
      
      const sIdx = parseInt(node.dataset.sidx);
      const qIdx = parseInt(node.dataset.qidx);
      const optKey = node.dataset.optkey;
      
      if (window.activeExamState) {
        window.activeExamState.sections[sIdx].questions[qIdx].correctAnswer = optKey;
        renderExam(); // Refresh to update highlighting
      }
    });
  });

  // Add Choice Option
  document.querySelectorAll('.btn-add-choice').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sIdx = parseInt(btn.dataset.sidx);
      const qIdx = parseInt(btn.dataset.qidx);
      const q = window.activeExamState.sections[sIdx].questions[qIdx];
      
      const nextKey = String.fromCharCode(65 + q.options.length);
      q.options.push({ key: nextKey, text: `Choice Option ${nextKey}` });
      renderExam();
    });
  });

  // Delete Choice Option
  document.querySelectorAll('.btn-del-choice').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sIdx = parseInt(btn.dataset.sidx);
      const qIdx = parseInt(btn.dataset.qidx);
      const oIdx = parseInt(btn.dataset.oidx);
      const q = window.activeExamState.sections[sIdx].questions[qIdx];
      
      q.options.splice(oIdx, 1);
      q.options.forEach((opt, idx) => {
        opt.key = String.fromCharCode(65 + idx);
      });
      
      if (!q.options.some(o => o.key === q.correctAnswer)) {
        q.correctAnswer = "A";
      }
      renderExam();
    });
  });

  // Add Question to Section
  document.querySelectorAll('.btn-add-question').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sIdx = parseInt(btn.dataset.sidx);
      const section = window.activeExamState.sections[sIdx];
      
      const newQuestion = {
        id: `q-custom-${Date.now()}`,
        questionNumber: 1, // Will be recomputed
        questionType: "multiple-choice",
        difficulty: "medium",
        points: 2,
        prompt: "Click here to write your custom mock question...",
        options: [
          { key: "A", text: "Choice A option" },
          { key: "B", text: "Choice B option" },
          { key: "C", text: "Choice C option" },
          { key: "D", text: "Choice D option" }
        ],
        correctAnswer: "A",
        explanation: "Click here to write your pedagogical justification..."
      };
      
      section.questions.push(newQuestion);
      renumberQuestions();
      recomputeTotalPoints();
      renderExam();
    });
  });

  // Adjust points value
  document.querySelectorAll('.btn-points').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sIdx = parseInt(btn.dataset.sidx);
      const qIdx = parseInt(btn.dataset.qidx);
      const q = window.activeExamState.sections[sIdx].questions[qIdx];
      
      const newPts = prompt(`Enter new point allocation for Question ${q.questionNumber}:`, q.points);
      if (newPts !== null) {
        const val = parseInt(newPts);
        if (!isNaN(val) && val >= 0) {
          q.points = val;
          recomputeTotalPoints();
          renderExam();
        }
      }
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sIdx = parseInt(btn.dataset.sidx);
      const qIdx = parseInt(btn.dataset.qidx);
      
      if (confirm('Are you sure you want to remove this question from the mock paper?')) {
        window.activeExamState.sections[sIdx].questions.splice(qIdx, 1);
        renumberQuestions();
        recomputeTotalPoints();
        renderExam();
      }
    });
  });
}

function renumberQuestions() {
  let counter = 1;
  window.activeExamState.sections.forEach(section => {
    section.questions.forEach(q => {
      q.questionNumber = counter++;
    });
  });
}

function recomputeTotalPoints() {
  let sum = 0;
  window.activeExamState.sections.forEach(section => {
    section.questions.forEach(q => {
      sum += q.points;
    });
  });
  window.activeExamState.examMetadata.totalPoints = sum;
  paperPoints.innerText = sum;
  if (marksTotalBadge) marksTotalBadge.innerText = sum;
  const previewMarksTotalBadge = document.getElementById('preview-marks-total-badge');
  if (previewMarksTotalBadge) previewMarksTotalBadge.innerText = sum;
}

function setPreviewMode(mode) {
  viewStudentBtn.classList.remove('active');
  viewTeacherBtn.classList.remove('active');
  viewSubmissionsBtn.classList.remove('active');
  
  testCanvas.classList.add('hide');
  submissionsCanvas.classList.add('hide');

  if (mode === 'student') {
    viewStudentBtn.classList.add('active');
    testCanvas.classList.remove('hide');
    testCanvas.classList.add('student-view');
    testCanvas.classList.remove('teacher-view');
  } else if (mode === 'teacher') {
    viewTeacherBtn.classList.add('active');
    testCanvas.classList.remove('hide');
    testCanvas.classList.add('teacher-view');
    testCanvas.classList.remove('student-view');
  } else if (mode === 'submissions') {
    viewSubmissionsBtn.classList.add('active');
    submissionsCanvas.classList.remove('hide');
    fetchSubmissions();
  }
}

async function fetchSubmissions() {
  if (!window.activeExamState) return;
  const shareId = window.activeExamState.shareId;
  const tbody = document.getElementById('submissions-table-body');
  
  if (!shareId) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-message">
          Submissions are collected in real-time. Please click <strong>"Share Exam Paper"</strong> at the top-right to generate a live shareable link first!
        </td>
      </tr>
    `;
    document.getElementById('stats-count').textContent = "0";
    document.getElementById('stats-avg').textContent = "--";
    document.getElementById('stats-high').textContent = "--";
    return;
  }

    tbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-table-message" style="color: var(--color-secondary) !important;">
        Querying backend submissions database...
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`/api/v1/share/${shareId}/submissions`);
    if (!res.ok) throw new Error("Could not fetch quiz responses.");
    
    const submissions = await res.json();
    console.log("[App] Submissions fetched:", submissions);

    if (submissions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-message">
            No student submissions recorded yet. Share the link to collect responses!
          </td>
        </tr>
      `;
      document.getElementById('stats-count').textContent = "0";
      document.getElementById('stats-avg').textContent = "--";
      document.getElementById('stats-high').textContent = "--";
      return;
    }

    // Sort submissions by timestamp descending
    submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Calculate statistics
    let sumPercentage = 0;
    let highestScore = 0;
    let totalPoints = submissions[0].totalPoints;

    tbody.innerHTML = '';
    submissions.forEach(sub => {
      sumPercentage += sub.percentage;
      if (sub.score > highestScore) highestScore = sub.score;

      const dateStr = new Date(sub.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let badgeClass = 'low';
      if (sub.percentage >= 75) badgeClass = 'high';
      else if (sub.percentage >= 45) badgeClass = 'mid';

      const tr = document.createElement('tr');

      const reviewBtn = document.createElement('button');
      reviewBtn.className = 'btn-view-submission';
      reviewBtn.title = 'Review student answers';
      reviewBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        Review
      `;
      Object.assign(reviewBtn.style, {
        background: 'transparent',
        border: '1px solid var(--color-primary)',
        color: 'var(--color-primary)',
        padding: '4px 10px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)'
      });
      reviewBtn.addEventListener('mouseenter', () => { reviewBtn.style.background = 'var(--color-primary)'; reviewBtn.style.color = 'white'; });
      reviewBtn.addEventListener('mouseleave', () => { reviewBtn.style.background = 'transparent'; reviewBtn.style.color = 'var(--color-primary)'; });
      reviewBtn.addEventListener('click', () => showAnswerReviewModal(sub));

      tr.innerHTML = `
        <td style="font-weight:600; color:var(--text-main);">${escapeHtml(sub.candidateName)}</td>
        <td><code>${escapeHtml(sub.rollNumber)}</code></td>
        <td style="color:var(--text-muted); font-size:12.5px;">${dateStr}</td>
        <td style="font-weight:700;">${sub.score} <span style="font-size:11.5px; font-weight:400; color:var(--text-muted);">/ ${sub.totalPoints}</span></td>
        <td><span class="percentage-badge ${badgeClass}">${sub.percentage}%</span></td>
        <td></td>
      `;
      tr.querySelector('td:last-child').appendChild(reviewBtn);
      tbody.appendChild(tr);
    });

    const averagePercentage = Math.round(sumPercentage / submissions.length);
    document.getElementById('stats-count').textContent = submissions.length;
    document.getElementById('stats-avg').textContent = averagePercentage;
    document.getElementById('stats-high').textContent = `${highestScore} / ${totalPoints}`;

  } catch (err) {
    console.error("Submissions dashboard fetch error:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-message" style="color: var(--color-danger) !important;">
          Failed to retrieve student submissions from backend database.
        </td>
      </tr>
    `;
  }
}

/**
 * Shows a rich modal overlay with a student's per-question answer review.
 * Highlights correct/wrong selections and shows essay responses.
 */
function showAnswerReviewModal(sub) {
  // Remove any existing modal
  const existing = document.getElementById('answer-review-modal');
  if (existing) existing.remove();

  const answers = sub.answers || [];

  let questionsHtml = '';

  if (answers.length === 0) {
    questionsHtml = `
      <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4; margin-bottom:12px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <p style="font-size:14px;">No detailed answer data is available for this submission.<br><span style="font-size:12px;">Only submissions taken after the latest update include per-question answers.</span></p>
      </div>
    `;
  } else {
    answers.forEach((ans, idx) => {
      const isObjective = ans.questionType === 'multiple-choice' || ans.questionType === 'true-false';

      let resultBadge = '';
      if (isObjective) {
        if (ans.studentAnswer === null) {
          resultBadge = `<span style="background:rgba(239,68,68,0.12);color:var(--color-danger);border:1px solid var(--color-danger);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;">Unanswered</span>`;
        } else if (ans.isCorrect) {
          resultBadge = `<span style="background:rgba(16,185,129,0.12);color:hsl(142,70%,45%);border:1px solid hsl(142,70%,45%);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;">✓ Correct (+${ans.earned} pts)</span>`;
        } else {
          resultBadge = `<span style="background:rgba(239,68,68,0.12);color:var(--color-danger);border:1px solid var(--color-danger);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;">✗ Incorrect (0 pts)</span>`;
        }
      } else {
        resultBadge = `<span style="background:hsla(220,75%,62%,0.12);color:var(--color-primary);border:1px solid var(--color-primary);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;">Subjective</span>`;
      }

      let choicesHtml = '';
      if (isObjective && ans.options && ans.options.length > 0) {
        choicesHtml = `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">`;
        ans.options.forEach(opt => {
          const isStudentPick = ans.studentAnswer === opt.key;
          const isCorrectOpt = ans.correctAnswer === opt.key;

          let bg = 'transparent';
          let border = '1px solid var(--panel-border)';
          let labelColor = 'var(--text-muted)';
          let textStyle = '';
          let indicator = '';

          if (isCorrectOpt && isStudentPick) {
            bg = 'rgba(16,185,129,0.1)';
            border = '2px solid hsl(142,70%,45%)';
            labelColor = 'hsl(142,70%,45%)';
            textStyle = 'font-weight:700;';
            indicator = `<span style="margin-left:auto;font-size:10px;font-weight:700;color:hsl(142,70%,45%);">✓ Your Answer</span>`;
          } else if (isCorrectOpt && !isStudentPick) {
            bg = 'rgba(16,185,129,0.06)';
            border = '2px solid hsl(142,70%,45%)';
            labelColor = 'hsl(142,70%,45%)';
            indicator = `<span style="margin-left:auto;font-size:10px;font-weight:700;color:hsl(142,70%,45%);">✓ Correct Answer</span>`;
          } else if (isStudentPick && !isCorrectOpt) {
            bg = 'rgba(239,68,68,0.1)';
            border = '2px solid var(--color-danger)';
            labelColor = 'var(--color-danger)';
            textStyle = 'font-weight:700;';
            indicator = `<span style="margin-left:auto;font-size:10px;font-weight:700;color:var(--color-danger);">✗ Your Answer</span>`;
          }

          choicesHtml += `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:${bg};border:${border};transition:all 0.2s;">
              <span style="width:26px;height:26px;border-radius:50%;border:2px solid ${labelColor};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:${labelColor};flex-shrink:0;">${opt.key}</span>
              <span style="font-size:13px;color:var(--text-main);${textStyle}">${escapeHtml(opt.text)}</span>
              ${indicator}
            </div>
          `;
        });
        choicesHtml += `</div>`;
      } else if (!isObjective) {
        // Essay answer
        const essayVal = ans.studentAnswer || '';
        choicesHtml = essayVal
          ? `<div style="margin-top:12px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.6;color:var(--text-main);white-space:pre-wrap;">${escapeHtml(essayVal)}</div>
             <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">Expected rubric answer: <strong style="color:var(--color-secondary);">${escapeHtml(ans.correctAnswer || 'See rubric')}</strong></div>`
          : `<div style="margin-top:12px;padding:12px;border-radius:8px;border:1px dashed var(--color-danger);color:var(--color-danger);font-size:12px;font-style:italic;">No written answer provided.</div>`;
      }

      const cardBorder = isObjective
        ? (ans.isCorrect ? 'border-left: 3px solid hsl(142,70%,45%);' : ans.studentAnswer === null ? 'border-left: 3px solid var(--panel-border);' : 'border-left: 3px solid var(--color-danger);')
        : 'border-left: 3px solid var(--color-primary);';

      questionsHtml += `
        <div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;padding:18px 20px;margin-bottom:14px;${cardBorder}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px;">
            <div style="display:flex;align-items:flex-start;gap:10px;flex:1;">
              <span style="flex-shrink:0;width:26px;height:26px;border-radius:6px;background:var(--panel-bg);border:1px solid var(--panel-border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--text-muted);">${idx + 1}</span>
              <p style="margin:0;font-size:13.5px;line-height:1.5;color:var(--text-main);font-weight:500;">${escapeHtml(ans.prompt)}</p>
            </div>
            <div style="flex-shrink:0;">${resultBadge}</div>
          </div>
          ${choicesHtml}
        </div>
      `;
    });
  }

  const badgeClass = sub.percentage >= 75 ? 'high' : sub.percentage >= 45 ? 'mid' : 'low';
  const badgeColors = { high: 'rgba(16,185,129,0.15)', mid: 'rgba(245,158,11,0.15)', low: 'rgba(239,68,68,0.15)' };
  const badgeTextColors = { high: 'rgb(16,185,129)', mid: 'rgb(245,158,11)', low: 'rgb(239,68,68)' };

  const modal = document.createElement('div');
  modal.id = 'answer-review-modal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 24px;
    overflow-y: auto;
    animation: fadeIn 0.25s ease;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      width: 100%;
      max-width: 720px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.5);
      overflow: hidden;
      margin: auto;
    ">
      <!-- Modal Header -->
      <div style="
        padding: 20px 24px;
        border-bottom: 1px solid var(--panel-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--card-bg);
        position: sticky;
        top: 0;
        z-index: 10;
      ">
        <div>
          <h3 style="margin:0;font-family:var(--font-display);font-size:16px;color:var(--text-main);">Answer Review — ${escapeHtml(sub.candidateName)}</h3>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">Roll: <code>${escapeHtml(sub.rollNumber)}</code> &nbsp;|&nbsp; Submitted: ${new Date(sub.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:800;font-family:var(--font-display);color:${badgeTextColors[badgeClass]}">${sub.percentage}%</div>
            <div style="font-size:11px;color:var(--text-muted);">${sub.score} / ${sub.totalPoints} pts</div>
          </div>
          <button id="close-review-modal" style="
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            color: var(--text-muted);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
            transition: all 0.2s;
          ">&times;</button>
        </div>
      </div>
      <!-- Question answers -->
      <div style="padding: 20px 24px 28px;">
        ${questionsHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeBtn = document.getElementById('close-review-modal');
  closeBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Hover effect on close button
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'var(--color-danger)'; closeBtn.style.color = 'white'; closeBtn.style.borderColor = 'var(--color-danger)'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'var(--panel-bg)'; closeBtn.style.color = 'var(--text-muted)'; closeBtn.style.borderColor = 'var(--panel-border)'; });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function setupExportDropdown() {
  exportDataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('hide');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.add('hide');
  });
}

/* ==========================================================================
   Link & QR Sharing System (Chamber Redirection)
   ========================================================================== */

async function openShareModal() {
  if (!window.activeExamState) return;

  btnShareExam.disabled = true;
  btnShareExam.innerHTML = "Generating link...";

  try {
    const response = await fetch('/api/v1/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.activeExamState)
    });

    if (!response.ok) throw new Error('Backend failed to serialize exam.');

    const data = await response.json();
    const shareId = data.shareId;
    
    // Save shareId in the active workbench state so submissions knows how to query!
    window.activeExamState.shareId = shareId;

    // Fetch LAN IP and Public Tunnel URL from backend
    let lanUrl = window.location.origin;
    let publicUrl = window.location.origin;
    try {
      const ipRes = await fetch('/api/v1/server-ip');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData) {
          lanUrl = ipData.lanUrl || window.location.origin;
          publicUrl = ipData.publicUrl || lanUrl;
        }
      }
    } catch (e) {
      console.warn("LAN IP and Public URL lookup failed, falling back to location origin.", e);
    }
    
    // Construct URLs
    const localShareUrl = `${window.location.origin}/view.html?id=${shareId}`;
    const lanShareUrl = `${publicUrl}/view.html?id=${shareId}`;
    
    // Set field values
    shareUrlInput.value = localShareUrl;
    btnCopyUrl.textContent = "Copy Local";
    
    shareUrlLanInput.value = lanShareUrl;
    btnCopyLanUrl.textContent = "Copy Network Link";

    // Set QR code generator image source targeting the LAN URL
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(lanShareUrl)}`;
    shareQrImage.src = qrApiUrl;

    // Show modal overlay
    shareModal.classList.remove('hide');
  } catch (err) {
    console.error(err);
    alert('Failed to generate share links: ' + err.message);
  } finally {
    btnShareExam.disabled = false;
    btnShareExam.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
      Share Exam Paper
    `;
  }
}

function closeShareModal() {
  shareModal.classList.add('hide');
}

function copyShareURL() {
  shareUrlInput.select();
  shareUrlInput.setSelectionRange(0, 99999); // for mobile devices
  
  navigator.clipboard.writeText(shareUrlInput.value)
    .then(() => {
      btnCopyUrl.textContent = "Copied!";
      setTimeout(() => {
        btnCopyUrl.textContent = "Copy Local";
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy text:', err);
    });
}

function copyShareLanURL() {
  shareUrlLanInput.select();
  shareUrlLanInput.setSelectionRange(0, 99999); // for mobile devices
  
  navigator.clipboard.writeText(shareUrlLanInput.value)
    .then(() => {
      btnCopyLanUrl.textContent = "Copied!";
      setTimeout(() => {
        btnCopyLanUrl.textContent = "Copy Network Link";
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy text:', err);
    });
}

/* ==========================================================================
   Data Export pipelines
   ========================================================================== */

function downloadJSON() {
  if (!window.activeExamState) return;
  const blob = new Blob([JSON.stringify(window.activeExamState, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(window.activeExamState.examMetadata.title || 'mock-exam')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCSV() {
  if (!window.activeExamState) return;

  const rows = [['Question Number', 'Type', 'Points', 'Difficulty', 'Prompt', 'Options', 'Correct Answer', 'Explanation']];
  window.activeExamState.sections.forEach(section => {
    section.questions.forEach(q => {
      let optsString = '';
      if (q.options && q.options.length > 0) {
        optsString = q.options.map(o => `${o.key}: ${o.text}`).join(' | ');
      }
      rows.push([
        q.questionNumber,
        q.questionType,
        q.points,
        q.difficulty,
        q.prompt,
        optsString,
        q.correctAnswer,
        q.explanation
      ]);
    });
  });

  const csvContent = "data:text/csv;charset=utf-8," 
    + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${sanitizeFilename(window.activeExamState.examMetadata.title || 'mock-exam')}-questions.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function sanitizeFilename(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
