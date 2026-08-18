#!/usr/bin/env python3
"""
Start backend (FastAPI, default :8080) and frontend (Vite :3000) in one terminal.
Ctrl+C stops both.

Usage (from repo root):
    python start.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DEFAULT_API_PORT = "8080"


def _venv_python() -> Path:
    if sys.platform == "win32":
        candidate = ROOT / ".venv" / "Scripts" / "python.exe"
    else:
        candidate = ROOT / ".venv" / "bin" / "python"
    return candidate if candidate.is_file() else Path(sys.executable)


def _check_prereqs() -> None:
    if not BACKEND_DIR.is_dir():
        print("ERROR: backend/ not found. Run from the repo root.")
        sys.exit(1)
    if not (FRONTEND_DIR / "package.json").is_file():
        print("ERROR: frontend/package.json not found.")
        sys.exit(1)
    if not (FRONTEND_DIR / "node_modules").is_dir():
        print("Frontend not installed. Run setup first:")
        print("  bash setup.sh")
        print("  — or —")
        print("  cd frontend && npm install")
        sys.exit(1)
    py = _venv_python()
    if not (ROOT / ".venv").is_dir() and py == Path(sys.executable):
        print("WARNING: .venv not found — using system Python.")
        print("  Recommended: python -m venv .venv && pip install -r backend/requirements.txt")


def _warn_if_port_blocked(port: str) -> None:
    """Detect another app (wrong JSON/HTML) already on the notebook API port."""
    url = f"http://127.0.0.1:{port}/health"
    try:
        with urllib.request.urlopen(url, timeout=2) as resp:
            body = resp.read(200).decode("utf-8", errors="replace")
            if resp.status == 200 and "litellm_available" in body:
                return
            print(f"WARNING: Port {port} responds but does not look like this notebook API.")
            print(f"  Set PORT to a free port, e.g. $env:PORT='8081'")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"WARNING: Port {port} is in use by another app (GET /health → 404).")
            print(f"  This notebook API will use PORT={port} — if startup fails, try:")
            print(f"    $env:PORT='8081'; $env:NOTEBOOK_API_PORT='8081'")
    except OSError:
        pass


def _start_backend(env: dict) -> subprocess.Popen:
    py = str(_venv_python())
    port = env.get("PORT", DEFAULT_API_PORT)
    print(f"→ Backend  http://localhost:{port}")
    return subprocess.Popen(
        [py, "main.py"],
        cwd=BACKEND_DIR,
        env=env,
    )


def _wait_for_backend(port: str, proc: subprocess.Popen, timeout_sec: float = 45.0) -> None:
    """Block until GET /health succeeds so Vite does not proxy into ECONNREFUSED."""
    url = f"http://127.0.0.1:{port}/health"
    deadline = time.time() + timeout_sec
    print(f"   waiting for backend on :{port}...", flush=True)
    while time.time() < deadline:
        if proc.poll() is not None:
            print(f"\nERROR: Backend exited with code {proc.returncode} before /health was ready.")
            sys.exit(proc.returncode or 1)
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    print(f"   backend ready ({url})", flush=True)
                    return
        except (urllib.error.URLError, OSError, TimeoutError):
            pass
        time.sleep(0.25)
    print(f"\nERROR: Backend did not respond on {url} within {timeout_sec:.0f}s.")
    sys.exit(1)


def _start_frontend(env: dict) -> subprocess.Popen:
    print("→ Frontend http://localhost:3000")
    cmd = "npm run dev -- --host 0.0.0.0 --port 3000"
    if sys.platform == "win32":
        return subprocess.Popen(cmd, cwd=FRONTEND_DIR, env=env, shell=True)
    return subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"],
        cwd=FRONTEND_DIR,
        env=env,
    )


def _stop(procs: list[subprocess.Popen]) -> None:
    for p in procs:
        if p.poll() is None:
            p.terminate()
    deadline = time.time() + 8
    for p in procs:
        if p.poll() is not None:
            continue
        remaining = max(0.1, deadline - time.time())
        try:
            p.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            p.kill()


def main() -> None:
    _check_prereqs()
    # Load repo-root .env so OLLAMA_API_KEY is visible before spawn + warnings.
    try:
        sys.path.insert(0, str(BACKEND_DIR))
        from notebooklm.env import load_env

        load_env()
    except Exception:
        pass

    env = os.environ.copy()
    env.setdefault("PORT", DEFAULT_API_PORT)
    env.setdefault("NOTEBOOK_API_PORT", env["PORT"])
    _warn_if_port_blocked(env["PORT"])

    print("")
    print("LLM Notebook — single terminal")
    print("Open http://localhost:3000 when both servers are up.")
    print("Ctrl+C to stop both.")
    has_llm = bool(
        env.get("OLLAMA_API_KEY")
        or env.get("OPENROUTER_API_KEY")
        or env.get("VLLM_BASE_URL")
        or env.get("OPENAI_API_BASE")
    )
    if not has_llm:
        print("")
        print("NOTE: No LLM key configured — put your Ollama Cloud key in repo-root .env:")
        print("    OLLAMA_API_KEY=...   # https://ollama.com/settings/keys")
        print("  Or PowerShell:")
        print("    $env:OLLAMA_API_KEY='...'")
        print("    $env:DEFAULT_MODEL='gpt-oss:120b'")
    print("")

    procs: list[subprocess.Popen] = []
    try:
        backend = _start_backend(env)
        procs.append(backend)
        _wait_for_backend(env["PORT"], backend)
        procs.append(_start_frontend(env))
        while True:
            for p in procs:
                code = p.poll()
                if code is not None:
                    names = ["backend", "frontend"]
                    idx = procs.index(p)
                    print(f"\n{names[idx]} exited with code {code}. Stopping the other.")
                    _stop(procs)
                    sys.exit(code if code else 1)
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        _stop(procs)


if __name__ == "__main__":
    main()
