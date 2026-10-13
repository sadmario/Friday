#!/usr/bin/env python3
"""
F.R.I.D.A.Y. AI - Environment & Dependency Diagnostic Script
Verifies Node.js, Electron, Python, Ollama, Models, and Supabase reachability.
"""
import sys
import subprocess
import shutil
import urllib.request
import json

def check_mark(status: bool) -> str:
    return "[\033[92mPASS\033[0m]" if status else "[\033[91mFAIL\033[0m]"

def run_diagnostics():
    print("\n=======================================================")
    print(" F.R.I.D.A.Y. AI — SYSTEM ENVIRONMENT DIAGNOSTIC")
    print("=======================================================\n")

    # 1. Node.js & npm
    node_path = shutil.which("node")
    npm_path = shutil.which("npm")
    print(f"{check_mark(bool(node_path))} Node.js: {node_path or 'Not found'}")
    print(f"{check_mark(bool(npm_path))} npm: {npm_path or 'Not found'}")

    # 2. Python
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    py_ok = sys.version_info >= (3, 10)
    print(f"{check_mark(py_ok)} Python: v{py_ver} ({sys.executable})")

    # 3. Ollama Connectivity & Models
    ollama_ok = False
    installed_models = []
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                installed_models = [m["name"] for m in data.get("models", [])]
                ollama_ok = True
    except Exception:
        ollama_ok = False

    print(f"{check_mark(ollama_ok)} Ollama Service (127.0.0.1:11434): {'Active' if ollama_ok else 'Unreachable'}")
    has_qwen = any("qwen3" in m or "qwen" in m for m in installed_models)
    print(f"{check_mark(has_qwen)} Ollama Models Detected: {installed_models or 'None'}")

    # 4. Supabase Endpoint
    supabase_url = "https://gnyqvduouavuexkknrmh.supabase.co/rest/v1/"
    supabase_ok = False
    try:
        req = urllib.request.Request(supabase_url)
        with urllib.request.urlopen(req, timeout=4) as resp:
            supabase_ok = resp.status in [200, 404]
    except Exception as e:
        # 401 or 404 means server is up and responding
        supabase_ok = "401" in str(e) or "404" in str(e)

    print(f"{check_mark(supabase_ok)} Supabase Cloud (gnyqvduouavuexkknrmh): {'Reachable' if supabase_ok else 'Unreachable'}")

    # 5. Local SQLite Database
    import os
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "data", "friday_local.db")
    db_exists = os.path.exists(db_path)
    print(f"{check_mark(db_exists)} Local SQLite DB: {db_path} ({'Found' if db_exists else 'Will create on launch'})")

    print("\n-------------------------------------------------------")
    if node_path and py_ok and ollama_ok:
        print(">> Status: System is ready to run F.R.I.D.A.Y. AI.")
    else:
        print(">> Status: Resolve any [FAIL] markers before launching.")
    print("=======================================================\n")

if __name__ == "__main__":
    run_diagnostics()
