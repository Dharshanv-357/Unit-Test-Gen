# 🌌 Nex AI Exams

Nex AI Exams is a full-stack, AI-powered examination engine designed for modern educators. Upload syllabus documents, textbook chapters, or course materials, and let the AI generate high-fidelity, pedagogically sound test papers instantly. 

Once generated, teachers can share exams with students, review answers in real-time, and download complete reports—all protected by a secure educator access panel.

---

## ✨ Features

* **🧠 AI Question Compiler:** Generates diverse question types (Multiple Choice, True/False, Short Answer Essays, and Problem Solving) tailored to specific learning materials.
* **🎯 Custom Parameters Studio:** Adjust difficulty profiles (Easy, Medium, Hard), total marks, estimated duration, and customize the question distribution matrix.
* **🌌 Deep Space Aesthetic:** Fully styled dark/light themes featuring glassmorphism panels, glowing ambient gradients, and smooth reactive transitions.
* **📋 Submissions Dashboard:** Review student answers in real-time. Highlights correct choices, points out wrong selections, and showcases written subjective answers.
* **🔒 Educator Access Control:** Teacher-facing panels, history data, and student grade sheets are protected by a secure credentials portal.
* **🔗 Dynamic Exam Sharing:** Share mock tests instantly via unique links and automatically generated QR codes. Local network (LAN) sharing is built-in.

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML5, CSS3 Variables (Deep Space Navy Theme), and clean ES6 Javascript.
* **Backend:** Node.js, Express.js.
* **Parsers:** `pdf-parse` and `mammoth` (for extracting textbook material from PDF and DOCX files).
* **Network Tunnels:** Localhost.run wrapper integration for public sharing.

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v16+ recommended).

### 2. Clone and Install
Clone the repository and install all dependencies:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd nex-ai-exams
npm install
```

### 3. Configure Environment Variables
Create a file named `.env` in the root directory and add your keys and administrator credentials:
```env
# AI Service Keys (e.g. Hugging Face key)
HUGGINGFACE_API_KEY=your_huggingface_key_here

# Educator Credentials
TEACHER_USERNAME=admin
TEACHER_PASSWORD=your_secure_password
```

### 4. Run the App
Launch the Express server:
```bash
node server.js
```
Open your browser and navigate to `http://localhost:3000` to start creating exams!

---

## 🛡️ Access Control Policy
* **Teachers Portal:** Guarded by `/login.html` authentication. Local storage tokens authorize requests to sensitive endpoints (history, submissions, delete operations).
* **Students Portal:** Zero authentication required. Accessing a quiz via `/view.html?id=SHARE_ID` is fast, public, and requires only a Name and Roll Number.

---

## 📜 License
This project is licensed under the ISC License. Created for educators aiming to streamline modern classroom assessments.
