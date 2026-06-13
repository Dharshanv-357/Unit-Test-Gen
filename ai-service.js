const fs = require('fs');

/**
 * Procedural Fallback Generator — used ONLY when every AI provider fails.
 * Keeps a minimal footprint: extracts real content from the document and builds
 * basic questions without rigid template rotation. The AI handles the real work.
 */
function generateProceduralMockTest(text, title, difficulty, distribution) {
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/(\w+)-\n(\w+)/g, '$1$2')
    .replace(/([a-z,;])\n\s*([a-z])/g, '$1 $2');

  const paragraphs = cleanText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 40);

  const mockTitle   = title || 'Academic Assessment';
  const finalDiff   = difficulty || 'Mixed';

  let dist = distribution || {};
  let mcCount = Number(dist.multipleChoice  ?? 5);
  let tfCount = Number(dist.trueFalse       ?? 3);
  let saCount = Number(dist.shortAnswer     ?? 2);
  let psCount = Number(dist.problemSolving  ?? 1);
  if (isNaN(mcCount) || mcCount < 0) mcCount = 5;
  if (isNaN(tfCount) || tfCount < 0) tfCount = 3;
  if (isNaN(saCount) || saCount < 0) saCount = 2;
  if (isNaN(psCount) || psCount < 0) psCount = 1;
  if (mcCount + tfCount + saCount + psCount === 0) { mcCount = 5; tfCount = 3; saCount = 2; psCount = 1; }

  // Extract informative sentences (contain a verb + are long enough to be factual)
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 45 && s.length < 400 && /[a-zA-Z]/.test(s))
    .filter(s => /\b(is|are|was|were|can|will|does|has|have|causes|results|leads|involves|requires|produces|enables|prevents|uses|works|helps|allows|forms|creates|reduces|improves|means|includes|consists|represents|affects|depends|occurs|provides)\b/i.test(s));

  const pool = sentences.length >= 4 ? sentences : cleanText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Extract key noun phrases (capitalized, repeated)
  const freq = {};
  const rx = /\b([A-Z][a-zA-Z]{2,28}(?:\s+[a-zA-Z]{2,20}){0,2})\b/g;
  let m;
  const skip = new Set(['The','This','That','These','Those','When','Where','Which','What','How','Why','But','And','For','Its','Our','They','Their','With','From','Also','Such','Both','Each','Some','Many','Most','More','Less','Into','Over','Under','After','Before','During','While','Since','About','Although','However','Therefore','Moreover']);
  while ((m = rx.exec(cleanText)) !== null) {
    const w = m[1].trim();
    if (w.length > 3 && !skip.has(w.split(' ')[0])) freq[w] = (freq[w] || 0) + 1;
  }
  const concepts = Object.entries(freq).filter(([,n]) => n >= 2).sort((a,b) => b[1]-a[1]).map(([c]) => c).slice(0, 12);

  function pickSentenceFor(concept) {
    const kw = concept.split(' ')[0].toLowerCase();
    return pool.find(s => s.toLowerCase().includes(kw)) || shuffled[0] || 'Refer to the source material.';
  }

  function distractorsFor(correctText) {
    const others = shuffled.filter(s => s !== correctText).slice(0, 3).map(s => s.substring(0, 120).trim());
    const pads = ['This element operates without interacting with other components.','Research suggests this factor has negligible impact in most cases.','The process completes independently without requiring external input.'];
    while (others.length < 3) others.push(pads[others.length]);
    return others;
  }

  function shuffleOptions(opts) {
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }

  const sections = [];
  let qNum = 1;
  let totalPoints = 0;
  const pts = (type) => ({ mc: finalDiff === 'Hard' ? 5 : finalDiff === 'Easy' ? 2 : 3, tf: 2, sa: 5, ps: 10 })[type];

  // ── Multiple Choice ──────────────────────────────────────────────────────
  if (mcCount > 0) {
    const qs = [];
    for (let i = 0; i < mcCount; i++) {
      const concept     = concepts[i % Math.max(concepts.length, 1)] || 'the subject';
      const correctSent = pickSentenceFor(concept);
      const correctText = correctSent.substring(0, 125).trim();
      const distractors = distractorsFor(correctSent);
      const rawOpts     = shuffleOptions([
        { key: 'A', text: correctText },
        { key: 'B', text: distractors[0] },
        { key: 'C', text: distractors[1] },
        { key: 'D', text: distractors[2] }
      ]);
      const answer = rawOpts.find(o => o.text === correctText)?.key || 'A';
      const p = pts('mc');
      totalPoints += p;
      qs.push({
        id: `q-mc-${i+1}`,
        questionNumber: qNum++,
        questionType: 'multiple-choice',
        difficulty: finalDiff.toLowerCase() === 'mixed' ? ['easy','medium','hard'][i % 3] : finalDiff.toLowerCase(),
        points: p,
        prompt: `Which of the following statements about ${concept} is correct based on the source material?`,
        contextSnippet: correctSent.substring(0, 200).trim(),
        options: rawOpts,
        correctAnswer: answer,
        explanation: `The correct answer is supported by the passage: "${correctText}". The other options are drawn from unrelated parts of the material or are factually inconsistent with it.`
      });
    }
    sections.push({ sectionTitle: 'Section A: Multiple Choice', instructions: 'Select the best answer for each question.', questions: qs });
  }

  // ── True / False ─────────────────────────────────────────────────────────
  if (tfCount > 0) {
    const qs = [];
    for (let i = 0; i < tfCount; i++) {
      const fact   = pool[(i * 4 + 1) % Math.max(pool.length, 1)] || pool[0] || 'The material covers key processes.';
      const isTrue = i % 2 === 0;
      const p = pts('tf');
      totalPoints += p;
      let prompt, explanation;
      if (isTrue) {
        prompt      = fact.substring(0, 175).trim();
        explanation = 'TRUE — This statement is directly supported by the source material.';
      } else {
        // Slightly distort: negate a key verb or prepend "Contrary to…"
        const distorted = fact
          .replace(/\b(increases|improves|enables|causes|produces|supports|enhances)\b/i,
            w => ({ increases:'decreases', improves:'worsens', enables:'prevents', causes:'eliminates', produces:'destroys', supports:'undermines', enhances:'reduces' })[w.toLowerCase()] || 'does not affect')
          .replace(/\b(is|are)\b(?! not)/i, '$& not');
        prompt      = (distorted !== fact ? distorted : `Contrary to the material: ${fact.substring(0, 100).toLowerCase()}.`).substring(0, 175).trim();
        explanation = `FALSE — The source material states: "${fact.substring(0, 120).trim()}".`;
      }
      qs.push({
        id: `q-tf-${i+1}`,
        questionNumber: qNum++,
        questionType: 'true-false',
        difficulty: 'easy',
        points: p,
        prompt,
        contextSnippet: fact.substring(0, 160).trim(),
        options: [{ key: 'True', text: 'True' }, { key: 'False', text: 'False' }],
        correctAnswer: isTrue ? 'True' : 'False',
        explanation
      });
    }
    sections.push({ sectionTitle: 'Section B: True or False', instructions: 'Decide if each statement is TRUE or FALSE based on the source material.', questions: qs });
  }

  // ── Short Answer ──────────────────────────────────────────────────────────
  if (saCount > 0) {
    const qs = [];
    for (let i = 0; i < saCount; i++) {
      const para    = paragraphs[i % Math.max(paragraphs.length, 1)] || pool[0] || 'Refer to the source material.';
      const concept = concepts[(i + Math.floor(concepts.length / 2)) % Math.max(concepts.length, 1)] || 'the main topic';
      const p = pts('sa');
      totalPoints += p;
      qs.push({
        id: `q-sa-${i+1}`,
        questionNumber: qNum++,
        questionType: 'short-answer',
        difficulty: 'medium',
        points: p,
        prompt: `Based on the source material, explain the significance of ${concept} and describe how it relates to the broader topic covered in this document.`,
        contextSnippet: para.substring(0, 250).trim(),
        correctAnswer: `A strong answer identifies what ${concept} is, explains its role in the subject, and connects it to at least one other concept or process described in the material.`,
        explanation: 'This question tests comprehension and ability to synthesize ideas — not just recall a definition.',
        rubric: [
          { step: 'Accurately describes the concept and its role in the material.', pointsAllocated: 2 },
          { step: 'Connects it to broader ideas or processes from the document with evidence.', pointsAllocated: 2 },
          { step: 'Clear, coherent writing with proper structure.', pointsAllocated: 1 }
        ]
      });
    }
    sections.push({ sectionTitle: 'Section C: Short Answer', instructions: 'Answer in 4–6 sentences. Support your answers with details from the source material.', questions: qs });
  }

  // ── Problem Solving ───────────────────────────────────────────────────────
  if (psCount > 0) {
    const qs = [];
    for (let i = 0; i < psCount; i++) {
      const para    = paragraphs[(i + 2) % Math.max(paragraphs.length, 1)] || pool[0] || 'Apply the knowledge from the material.';
      const concept = concepts[(i + 1) % Math.max(concepts.length, 1)] || 'the core concept';
      const p = pts('ps');
      totalPoints += p;
      qs.push({
        id: `q-ps-${i+1}`,
        questionNumber: qNum++,
        questionType: 'problem-solving',
        difficulty: 'hard',
        points: p,
        prompt: `Using the concepts covered in the source material, describe how you would apply ${concept} to solve a real-world problem. Include a step-by-step approach, identify at least one challenge you might face, and explain how you would measure success.\n\nContext from the material:\n"${para.substring(0, 220)}..."`,
        contextSnippet: para.substring(0, 220).trim(),
        correctAnswer: `Strong answer: (1) Defines the problem and why ${concept} is relevant. (2) Outlines clear, ordered steps to apply it. (3) Names at least one realistic challenge with a mitigation. (4) Defines how results would be evaluated.`,
        explanation: 'This tests application — the ability to take knowledge from the material and use it in a new context.',
        rubric: [
          { step: `Clearly identifies ${concept} and its relevance to the scenario.`, pointsAllocated: 2 },
          { step: 'Provides a logical, ordered step-by-step approach.', pointsAllocated: 3 },
          { step: 'Identifies at least one challenge and proposes a solution.', pointsAllocated: 3 },
          { step: 'Defines measurable success criteria or expected outcomes.', pointsAllocated: 2 }
        ]
      });
    }
    sections.push({ sectionTitle: 'Section D: Problem Solving', instructions: 'Provide a structured, analytical response. Show your reasoning — partial credit is given for logical thinking.', questions: qs });
  }

  return {
    examMetadata: { title: mockTitle, generatedDate: new Date().toISOString(), estimatedDurationMinutes: mcCount*2 + tfCount*1.5 + saCount*10 + psCount*15, totalPoints, difficultyProfile: finalDiff },
    sections
  };
}

/**
 * Heals and normalizes any raw AI JSON output into the expected schema.
 */
function normalizeExamState(rawObj, defaultTitle = 'Academic Assessment') {
  if (!rawObj || typeof rawObj !== 'object') throw new Error('Invalid exam object.');

  const rawMeta = rawObj.examMetadata || {};
  const meta = {
    title: rawMeta.title || rawObj.title || defaultTitle,
    generatedDate: rawMeta.generatedDate || new Date().toISOString(),
    estimatedDurationMinutes: Number(rawMeta.estimatedDurationMinutes || rawMeta.duration || 45),
    difficultyProfile: rawMeta.difficultyProfile || rawMeta.difficulty || 'Mixed'
  };

  let rawSections = rawObj.sections || rawObj.examSections || [];
  if (!Array.isArray(rawSections)) {
    rawSections = rawObj.questions ? [{ sectionTitle: 'Section I', instructions: 'Answer all questions.', questions: rawObj.questions }] : [];
  }

  let totalPoints = 0;
  let qCounter    = 1;

  const sections = rawSections.map((sec, sIdx) => {
    const rawQs = Array.isArray(sec.questions || sec.items) ? (sec.questions || sec.items) : [];
    const questions = rawQs.map((q, qIdx) => {
      const questionType = q.questionType || q.type || 'multiple-choice';
      let points = Number(q.points || q.score || q.marks || 2);
      if (isNaN(points)) points = 2;
      totalPoints += points;

      let options = [];
      const rawOpts = q.options || q.choices || [];
      if (Array.isArray(rawOpts) && rawOpts.length > 0) {
        options = rawOpts.map((o, i) => typeof o === 'object' ? { key: o.key || String.fromCharCode(65+i), text: o.text || o.value || '' } : { key: String.fromCharCode(65+i), text: String(o) });
      } else if (questionType === 'true-false') {
        options = [{ key: 'True', text: 'True' }, { key: 'False', text: 'False' }];
      } else {
        options = ['A','B','C','D'].map(k => ({ key: k, text: `Option ${k}` }));
      }

      let correctAnswer = String(q.correctAnswer || q.answer || 'A');
      if (questionType === 'true-false') {
        const v = correctAnswer.trim().toLowerCase();
        correctAnswer = (v === 'true' || v === '1' || v === 't') ? 'True' : 'False';
      }

      const rubric = Array.isArray(q.rubric) ? q.rubric.map(r => typeof r === 'object' ? { step: r.step || '', pointsAllocated: Number(r.pointsAllocated || 1) } : { step: String(r), pointsAllocated: 1 }) : [];

      return {
        id: q.id || `q-${sIdx}-${qIdx}`,
        questionNumber: Number(q.questionNumber || q.number || qCounter++),
        questionType,
        difficulty: q.difficulty || 'medium',
        points,
        prompt: q.prompt || q.question || q.text || '',
        contextSnippet: q.contextSnippet || q.snippet || '',
        options,
        correctAnswer,
        explanation: q.explanation || q.answerExplanation || '',
        rubric
      };
    });
    return {
      sectionTitle: sec.sectionTitle || sec.title || `Section ${String.fromCharCode(65 + sIdx)}`,
      instructions: sec.instructions || sec.sectionInstructions || '',
      questions
    };
  });

  meta.totalPoints = totalPoints;
  return { examMetadata: meta, sections };
}

function validateAndNormalize(rawJSONText, title) {
  const parsed = normalizeExamState(JSON.parse(rawJSONText), title);
  if (!parsed.sections.some(s => s.questions && s.questions.length > 0)) {
    throw new Error('AI returned valid JSON but with zero questions.');
  }
  return parsed;
}

/**
 * Main entry point. Tries AI providers in order, falls back to procedural only as last resort.
 */
async function generateMockTest(text, title, difficulty, distribution, customInstructions) {
  const geminiKey  = process.env.GEMINI_API_KEY;
  const openaiKey  = process.env.OPENAI_API_KEY;
  const hfKey      = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;

  // ── Clean, natural prompt — AI decides question styles freely ─────────────
  const systemMessage = `You are an experienced university educator and exam designer.
Your job is to create a high-quality mock exam based strictly on the content provided by the user.
Write questions the way a skilled teacher would — each question should feel natural and purposeful, testing what a student should genuinely understand about the topic.
Return ONLY a valid JSON object. No markdown, no explanation, no extra text.`;

  const userMessage = `Create a mock exam based on the following source material.

EXAM SETTINGS:
- Title: "${title || 'Academic Assessment'}"
- Difficulty: "${difficulty || 'Mixed'}"
- Questions needed: ${distribution.multipleChoice} Multiple Choice, ${distribution.trueFalse} True/False, ${distribution.shortAnswer} Short Answer, ${distribution.problemSolving} Problem Solving
${customInstructions ? `- Extra instructions: "${customInstructions}"` : ''}

SOURCE MATERIAL:
"""
${text}
"""

Write questions that genuinely test understanding of the topics in this material. Questions should feel like they were written by an expert teacher — varied, meaningful, and directly tied to the specific subject matter. Avoid generic question styles.

Return this exact JSON structure (no extra text):
{
  "examMetadata": {
    "title": "string",
    "estimatedDurationMinutes": number,
    "totalPoints": number,
    "difficultyProfile": "Easy" | "Medium" | "Hard" | "Mixed"
  },
  "sections": [
    {
      "sectionTitle": "string",
      "instructions": "string",
      "questions": [
        {
          "id": "string",
          "questionNumber": number,
          "questionType": "multiple-choice" | "true-false" | "short-answer" | "problem-solving",
          "difficulty": "easy" | "medium" | "hard",
          "points": number,
          "prompt": "string",
          "contextSnippet": "string",
          "options": [{"key": "A", "text": "string"}, {"key": "B", "text": "string"}, {"key": "C", "text": "string"}, {"key": "D", "text": "string"}],
          "correctAnswer": "A" | "B" | "C" | "D" | "True" | "False" | "string",
          "explanation": "string",
          "rubric": [{"step": "string", "pointsAllocated": number}]
        }
      ]
    }
  ]
}`;

  // 1. Gemini
  if (geminiKey) {
    try {
      console.log('[AI Engine] Trying Gemini...');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemMessage}\n\n${userMessage}` }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.5 } })
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const d = await res.json();
      const raw = d.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
      return validateAndNormalize(raw, title);
    } catch (e) { console.warn('[AI Engine] Gemini failed:', e.message); }
  }

  // 2. OpenAI
  if (openaiKey) {
    try {
      console.log('[AI Engine] Trying OpenAI...');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.5, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemMessage }, { role: 'user', content: userMessage }] })
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const d = await res.json();
      return validateAndNormalize(d.choices[0].message.content, title);
    } catch (e) { console.warn('[AI Engine] OpenAI failed:', e.message); }
  }

  // 3. Hugging Face (Inference Providers router)
  if (hfKey) {
    const models = ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'];
    for (const model of models) {
      try {
        console.log(`[AI Engine] Trying Hugging Face (${model})...`);
        const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfKey}` },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: systemMessage }, { role: 'user', content: userMessage }], temperature: 0.5, max_tokens: 4096 })
        });
        if (!res.ok) { const t = await res.text(); throw new Error(`HF ${res.status}: ${t.substring(0,150)}`); }
        const d = await res.json();
        const raw = (d.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
        const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('No JSON object in HF response');
        const result = validateAndNormalize(raw.substring(start, end + 1), title);
        console.log(`[AI Engine] Hugging Face success (${model})`);
        return result;
      } catch (e) { console.warn(`[AI Engine] HF model ${model} failed:`, e.message); }
    }
  }

  // 4. Pollinations (free, keyless)
  const pollinationsModels = ['openai', 'llama', 'mistral', 'qwen-large'];
  for (const model of pollinationsModels) {
    try {
      console.log(`[AI Engine] Trying Pollinations (${model})...`);
      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: systemMessage }, { role: 'user', content: userMessage }], model, jsonMode: true })
      });
      if (!res.ok) { console.warn(`[AI Engine] Pollinations ${model} returned ${res.status}`); continue; }
      const raw = (await res.text()).replace(/```json|```/g, '').trim();
      const result = validateAndNormalize(raw, title);
      console.log(`[AI Engine] Pollinations success (${model})`);
      return result;
    } catch (e) { console.warn(`[AI Engine] Pollinations ${model} failed:`, e.message); }
  }

  // 5. Procedural fallback (last resort — AI generates real questions; this is just structural scaffolding)
  console.log('[AI Engine] All AI providers failed. Using procedural fallback...');
  return normalizeExamState(generateProceduralMockTest(text, title, difficulty, distribution, customInstructions), title);
}

module.exports = { generateMockTest };
