# Troubleshooting

## API shows Disconnected

- Start the backend: `notebooklm app run`
- Frontend proxies `/api` → `http://localhost:8000` (see `frontend/vite.config.js`)

## 503 from `/workflow/*`

- Set `OPENROUTER_API_KEY`
- Or set `VLLM_BASE_URL` for a local OpenAI-compatible server
- Confirm LiteLLM is installed: `pip install litellm`

## DSL parse errors

- Use 2-space indentation
- Top-level keyword is `workflow` (not `pipeline`)
- Prompt nodes need `prompt:`; code nodes need `code:`
- Use `/workflow/check_syntax` or the live UI underline

## Code node failures

- Code runs with `exec` in the API process (local-dev only — not sandboxed)
- Bind outputs with `result = ...` or the `output:` name

## Windows notes

- Use PowerShell env vars (`$env:OPENROUTER_API_KEY=...`)
- `setup.sh` is optional; prefer `pip install -e .` + `npm run dev`
