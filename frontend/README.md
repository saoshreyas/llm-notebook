# Frontend — React + Vite + Tailwind

Jupyter-style notebook UI with two-stage execution, state indicators, and keyboard shortcuts.

## Setup

```bash
npm install
npm run dev
```

Opens on http://localhost:3000. Proxies `/api/*` to the backend at `localhost:8000`.

## Components

| Component | File | Purpose |
|-----------|------|---------|
| App | `src/App.jsx` | Main app: state management, keyboard shortcuts, layout |
| NotebookCell | `src/components/NotebookCell.jsx` | Two-stage cell with state indicators |
| CommandBar | `src/components/CommandBar.jsx` | Keyboard shortcuts & help modal |
| InfoPanel | `src/components/InfoPanel.jsx` | Top info panel explaining two-stage execution |
| Button | `src/components/Button.jsx` | Reusable styled button |
| Card | `src/components/Card.jsx` | Reusable card components |

## Design

- Jupyter Notebook appearance: orange accents, white cells, `In[]/Out[]` labels
- Light theme with monospace fonts (Consolas/Monaco)
- Cell states shown with colored indicators (gray → blue → yellow → purple → green)
- Left border color changes with execution state

## Build

```bash
npm run build    # Production build in dist/
npm run preview  # Preview production build
```
