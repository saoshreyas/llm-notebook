# Hand-test examples for the NotebookLM UI (http://localhost:3000)

## How to run

1. Start API: `python -m notebooklm app run` (from repo root, `PYTHONPATH=backend`)
2. Start UI: `cd frontend && npm run dev`
3. Open http://localhost:3000

**Text mode:** paste natural language → Shift+Enter (NL→DSL) → edit `.wfl` if needed → Shift+Enter (interpret).

**DSL mode:** toggle cell to DSL → paste a `.wfl` file → Interpret / Shift+Enter.

In Text mode, your cell text is also passed as `{{task}}` into the workflow.

---

## A. Text mode (natural language)

Paste one of these, then run twice (Shift+Enter × 2).

### 1. Tiny smoke test
```
Build a workflow with one prompt node that replies in one sentence about: why notebooks help agent debugging. Then a code node that counts characters of that reply.
```

### 2. Research agent
```
Create a research agent workflow: plan 3 steps, gather notes, then answer. Topic: what is a semantic DSL interpreter? Use prompt nodes and end with a code node that wraps the answer and its length in a dict.
```

### 3. Summarize
```
Make a two-node workflow: first summarize the user's text in 2 sentences, then turn that summary into 3 bullets. The input text is: Large language models can call tools, but a reviewable workflow DSL makes each step explicit and easier to debug.
```

### 4. Translator-style
```
Workflow: one prompt node translates {{task}} into simple English for a beginner. Task text: "A balloon context accumulates prior node outputs for later LLM prompts."
```

---

## B. DSL mode (paste `.wfl` directly)

### 1. Hello (prompt + code) — file: `hello.wfl`

Toggle **DSL**, paste contents of `backend/examples/hello.wfl`, then Interpret.

For `{{task}}` to be filled in Text mode, use Text mode with NL that generates similar DSL, or run CLI:
```powershell
$env:PYTHONPATH="backend"
python -m notebooklm interpret backend/examples/hello.wfl --input task="semantic interpreters"
```

**UI tip:** In DSL mode there is no automatic `task` input. Either:
- hardcode the topic inside the prompt string, or
- use Text mode so the cell text becomes `{{task}}`.

Hardcoded variant to paste in DSL mode:

```text
workflow hello:
  config:
    retries: 1

  node greet:
    kind: prompt
    prompt: "In one short sentence, explain what a balloon context is in a workflow notebook."
    output: greeting

  node stats:
    kind: code
    input: greeting
    code: |
      result = {"greeting": greeting, "chars": len(greeting)}
    output: result
```

### 2. Math only (no LLM) — file: `math_only.wfl`

Paste `backend/examples/math_only.wfl` in DSL mode and Interpret. Should succeed even without a working API key (code nodes only).

### 3. Summarize — file: `summarize.wfl`

Prefer Text mode with example A.3 so `{{task}}` is set. Or paste this hardcoded DSL:

```text
workflow summarize:
  config:
    retries: 1

  node summary:
    kind: prompt
    prompt: |
      Summarize in 2 sentences:
      Large language models can call tools, but a reviewable workflow DSL makes each step explicit and easier to debug.
    output: summary

  node bullets:
    kind: prompt
    prompt: |
      Turn this summary into exactly 3 short bullet points.
      Summary: {{summary}}
    input: summary
    output: bullets
```

### 4. Full research agent — file: `research_agent.wfl`

Text mode with A.2, or CLI:
```powershell
python -m notebooklm interpret backend/examples/research_agent.wfl --input task="What is NotebookLM?"
```

---

## C. What “good” looks like

| Example | Expect |
|---------|--------|
| math_only | Green badges; `sum=15`, `mean=3.0` |
| hello | Prompt text + code dict with `chars` |
| summarize | Summary node then 3 bullets |
| research_agent | plan → notes → answer → `{"answer": ..., "length": ...}` |

If NL→DSL fails parse, edit the yellow `.wfl` box (2-space indent, `workflow` / `kind: prompt|code`) and Interpret again.
