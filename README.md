<div align="center">

# 🌌 Nex AI Exams
### *The Intelligent, Secure, Full-Stack Examination Engine*

[![Live Deployment](https://img.shields.io/badge/live-deployment-success.svg?style=flat-squared&color=10b981)](https://unit-test-gen.onrender.com)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-blue.svg?style=flat-squared&color=06b6d4)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-purple.svg?style=flat-squared&color=8b5cf6)](LICENSE)
[![Security Status](https://img.shields.io/badge/security-admin--authenticated-red.svg?style=flat-squared)](https://github.com/)

**Nex AI Exams** compiles raw educational course material, textbook chapters, or lecture notes into professionally structured tests in seconds, featuring real-time submission metrics and secure administration.

[Demo & Setup](#-quick-start) • [Core Features](#-features) • [Platform Architecture](#-architecture)

</div>

---

## ⚡ Features

* **🔮 AI Assessment Compiler**
  * Auto-generates Multiple Choice (MCQ), True/False, Short Essay, and Problem Solving questions directly from your uploads.
  * Adjusts question ratios, points allocation, and time limits dynamically.
* **🪐 Deep Space Visual Interface**
  * Premium, responsive interface featuring glassmorphic panels and glow animations.
  * Native system-matching Light & Dark parchment themes.
* **🔒 Gatekeeper Security middleware**
  * Dashboard, history logs, and grades are secured using custom administrator session tokens.
  * Student portals (`/view.html`) require no login—only a name and roll number.
* **📡 Real-Time Analytics Dashboard**
  * Submissions logs collect and display student percentage rankings.
  * Per-question review modal highlighting chosen vs. correct answers.
* **🔗 Dynamic Sharing & LAN Resolution**
  * Automatically resolves network IP to generate local Wi-Fi share links and scanable QR codes.
  * Secure public secure tunneling powered by localhost.run is built-in.

---

## 📐 Architecture

```mermaid
flowchart LR
    A[Textbook/Notes] -->|Upload| B(AI Model API)
    B -->|Parse Questions| C[Teacher Dashboard]
    C -->|Generate Share Link| D[Student Quiz Portal]
    D -->|Submit Answers| E[Live Grades & Metrics]
    C -.->|Access Protected by| F[Access Login Portal]
```

---

## 🚀 Quick Start

### 1. Install Project
```bash
npm install
```

### 2. Configure Credentials (`.env`)
Create a `.env` file in the root folder:
```env
# AI Model Authentication
HUGGINGFACE_API_KEY=your_key_here

# Administration Access
TEACHER_USERNAME=admin
TEACHER_PASSWORD=admin123
```

### 3. Start Local Environment
```bash
node server.js
```
* **Dashboard Access:** `http://localhost:3000/login.html`
* **Student Interface:** `http://localhost:3000/view.html`

---

<div align="center">
Designed for modern classrooms and secure test execution.
</div>
