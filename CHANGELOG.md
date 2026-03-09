# Changelog

## v2.0.0 — Two-Stage Processing Release

### Architecture
- Split single `/process` endpoint into separate `/translate` and `/interpret` endpoints
- Each stage runs independently — users must run twice to complete both stages
- Backend reads `VLLM_BASE_URL` and `DEFAULT_MODEL` from environment variables
- Legacy `/process` endpoint preserved for backwards compatibility

### Jupyter-Style UI
- Complete visual redesign to match classic Jupyter Notebook appearance
- Orange accents (#FF6B19) matching Jupyter's brand color
- White/light gray cells on white background (not dark theme)
- Jupyter-style header with "Untitled.ipynb" notebook name
- `In [X]:` and `Out [X]:` execution number indicators
- Monospace font (Consolas/Monaco) for code cells
- Cell borders with hover states like real Jupyter
- "Insert Cell Below" button appears between cells on hover

### Two-Stage Execution System
- First run translates text (Stage 1)
- Second run interprets balloons (Stage 2)
- Button text changes: "Translate" → "Interpret" → "Translate" (after clear)
- Clear visual feedback at each stage

### Visual State Indicators
- ⚪ Gray = Not executed
- 🔵 Blue spinner = Translating (Stage 1 running)
- 🟡 Yellow = Translated (ready for Stage 2)
- 🟣 Purple spinner = Interpreting (Stage 2 running)
- 🟢 Green = Complete (both stages done)
- 🔴 Red = Error
- Left border color changes with state (yellow → green)
- State label visible in cell header at all times

### Keyboard Shortcuts
- `Shift+Enter` — Run current cell
- `Ctrl+Enter` — Run cell and insert new cell below
- `Alt+A` — Add new cell below
- `Alt+D` — Delete focused cell
- `Ctrl+/` — Toggle shortcuts help modal
- `Esc` — Close dialogs
- All shortcuts work globally

### Command Bar / Help Modal
- Floating "Shortcuts" button in top-right header
- Modal shows all keyboard shortcuts with styled key badges
- Explains each cell state with colored indicators
- Documents what users CAN and CANNOT do
- Two-stage execution explanation in blue info box
- Closable with Esc or X button

### Info Panel
- Blue Jupyter-style info box at the top of the notebook
- Explains two-stage execution with Stage 1/Stage 2 breakdown
- Shows example text to try
- Lists key shortcuts inline

### Cell Features
- Auto-resizing textarea that grows with content
- Placeholder text with examples and shortcut hints
- Execution numbers track run order
- Focus detection for keyboard shortcuts
- Individual cell controls: Run, Clear, Delete
- Cannot delete last remaining cell

### Documentation
- Main README with architecture diagram
- QUICKSTART guide
- SHORTCUTS.md reference
- TROUBLESHOOTING.md guide
- CHANGELOG.md (this file)

### Shell Scripts
- `setup.sh` — Automated dependency installation
- `start-all.sh` — Start both servers
- `start-backend.sh` — Start backend only
- `start-frontend.sh` — Start frontend only

---

## v1.0.0 — Initial Release

- Basic FastAPI backend with single `/process` endpoint
- React frontend with dark theme
- Single-stage execution (translate + interpret at once)
- Basic cell management
