# F.R.I.D.A.Y. AI — Setup & Configuration Guide

## 1. Prerequisites
- **Operating System**: Windows 11 (64-bit)
- **Node.js**: v18+ (tested on Node.js v24)
- **Python**: v3.10+ (tested on Python 3.11 with `uv`)
- **Ollama**: v0.4+ installed and running locally
- **Hardware**: NVIDIA GPU (e.g. RTX 3050 with 4GB VRAM) or modern multi-core CPU

---

## 2. Ollama & Local Model Setup
1. Ensure Ollama is running on your machine:
   ```powershell
   ollama serve
   ```
2. Pull the recommended high-performance small model:
   ```powershell
   ollama pull qwen3:4b
   ```
3. Verify installed models:
   ```powershell
   ollama list
   ```
4. F.R.I.D.A.Y. automatically connects to `http://127.0.0.1:11434` and detects available models. You can switch models live in the **Settings** or **Diagnostics** page.

---

## 3. Python Local Backend Setup
1. From the project root (`d:\F.R.I.D.A.Y`), create a virtual environment:
   ```powershell
   uv venv backend/.venv --python 3.11
   ```
2. Install dependencies:
   ```powershell
   uv pip install --python backend/.venv fastapi uvicorn pydantic httpx aiosqlite apscheduler pytest pytest-asyncio pypdf python-docx pyttsx3 psutil
   ```
3. Run tests to confirm integrity:
   ```powershell
   $env:PYTHONPATH="backend"
   backend\.venv\Scripts\pytest.exe backend/tests/test_backend.py -v
   ```

---

## 4. Running in Development Mode
Run the backend and frontend concurrently:
```powershell
npm run dev:electron
```
Or run the backend service:
```powershell
npm run backend:dev
```
And in another terminal:
```powershell
npm run dev
```

---

## 5. Production Windows Installer
To build the standalone Windows installer and portable binary:
```powershell
npm run dist
```
Output files will be generated in `release/`:
- `F.R.I.D.A.Y. AI Setup 1.0.0.exe` (NSIS Installer)
- `F.R.I.D.A.Y. AI 1.0.0.exe` (Portable Executable)
