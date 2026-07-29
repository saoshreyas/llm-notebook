# Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Enter` | Run current cell (NL→DSL or interpret) |
| `Ctrl+Enter` | Run cell and insert new cell below |
| `Alt+A` | Add new cell below |
| `Alt+D` | Delete focused cell |
| `Ctrl+/` | Toggle shortcuts help |
| `Esc` | Close dialogs |

## Cell states

| State | Meaning |
|-------|---------|
| Not executed | Idle |
| NL → DSL | Translating natural language to `.wfl` |
| DSL ready | Editable workflow — run again to interpret |
| Interpreting | Semantic run in progress |
| Complete / Partial | Finished (all or some nodes ok) |
| Error | Failure |

## Modes

- **Text:** two-phase — translate, then interpret
- **DSL:** write `.wfl` directly, then interpret
