# Keyboard Shortcuts Reference

## Cell Execution

| Shortcut | Action | Details |
|----------|--------|---------|
| `Shift + Enter` | Run current cell | Translates if not yet run; interprets if already translated |
| `Ctrl + Enter` | Run cell + add new | Runs the cell and inserts a new empty cell below |

## Cell Management

| Shortcut | Action | Details |
|----------|--------|---------|
| `Alt + A` | Add cell below | Inserts a new empty cell after the focused cell |
| `Alt + D` | Delete cell | Deletes the focused cell (cannot delete last cell) |

## Navigation & Help

| Shortcut | Action | Details |
|----------|--------|---------|
| `Ctrl + /` | Toggle help | Opens/closes the shortcuts & help modal |
| `Esc` | Close dialog | Closes any open modal or dialog |

## Execution Flow

```
New cell (⚪ Not executed)
    │
    ├── Shift+Enter ──→ 🔵 Translating... ──→ 🟡 Translated
    │                                              │
    │                    Shift+Enter ◄──────────────┘
    │                        │
    │                        ▼
    │                    🟣 Interpreting... ──→ 🟢 Complete
    │
    └── Clear ──→ ⚪ Not executed (start over)
```

## Tips

- Click on a cell to focus it before using shortcuts
- The run button label changes based on cell state ("Translate" vs "Interpret")
- You can re-run a completed cell — it starts over from Stage 1
- Hover between cells to reveal the "Insert Cell Below" button
