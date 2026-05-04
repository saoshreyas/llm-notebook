import {
  Keyboard, Info, CheckCircle2, XCircle, Circle, Loader2, AlertCircle,
} from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Alert, AlertDescription } from './ui/alert'

const SHORTCUTS = [
  { keys: ['Shift', 'Enter'], desc: 'Run cell (NL→DSL, interpreter, or execution step)', section: 'execute' },
  { keys: ['Ctrl', 'Enter'], desc: 'Run cell and insert a new cell below', section: 'execute' },
  { keys: ['Alt', 'A'], desc: 'Add new cell below the focused cell', section: 'cells' },
  { keys: ['Alt', 'D'], desc: 'Delete the focused cell', section: 'cells' },
  { keys: ['Ctrl', '/'], desc: 'Toggle this help panel', section: 'nav' },
  { keys: ['Esc'], desc: 'Close dialogs and modals', section: 'nav' },
]

const STATES = [
  { emoji: '⚪', variant: 'idle', icon: Circle, label: 'Not executed', desc: 'Cell has not been run yet' },
  { emoji: '🔵', variant: 'translating', icon: Loader2, label: 'NL → DSL...', desc: 'LLM writes NotebookDSL; server retries if the parser rejects it' },
  { emoji: '🟡', variant: 'translated', icon: CheckCircle2, label: 'DSL ready', desc: 'Valid .ndsl — run again to start the interpreter' },
  { emoji: '🟣', variant: 'interpreting', icon: Loader2, label: 'Interpreter...', desc: 'Per node: generate Python, verify, execute; errors fed back in a loop' },
  { emoji: '🟢', variant: 'complete', icon: CheckCircle2, label: 'Complete', desc: 'Execution finished; see output below' },
  { emoji: '🔴', variant: 'error', icon: AlertCircle, label: 'Error', desc: 'Something went wrong (network, parse after retries, or runtime)' },
]

const CAN_DO = [
  'Add unlimited cells (Alt+A or button)',
  'Delete any cell except the last one (Alt+D)',
  'Run cells in any order',
  'Re-run cells multiple times',
  'Clear output and restart the cell',
  'Edit input text after running',
  'Use all keyboard shortcuts',
]

const CANNOT_DO = [
  'Delete the last remaining cell (always keep at least 1)',
]

function Kbd({ children }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-medium bg-muted border rounded shadow-sm">
      {children}
    </kbd>
  )
}

export default function CommandBar({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Help & Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Natural language → DSL → interpreter → output. Shortcuts and cell states.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="shortcuts" className="px-6 pb-5">
          <TabsList className="w-full">
            <TabsTrigger value="shortcuts" className="flex-1 text-xs">Shortcuts</TabsTrigger>
            <TabsTrigger value="states" className="flex-1 text-xs">Cell States</TabsTrigger>
            <TabsTrigger value="guide" className="flex-1 text-xs">User Guide</TabsTrigger>
          </TabsList>

          {/* Tab: Shortcuts */}
          <TabsContent value="shortcuts" className="space-y-4">
            <ShortcutSection title="Execution" shortcuts={SHORTCUTS.filter(s => s.section === 'execute')} />
            <Separator />
            <ShortcutSection title="Cell Management" shortcuts={SHORTCUTS.filter(s => s.section === 'cells')} />
            <Separator />
            <ShortcutSection title="Navigation" shortcuts={SHORTCUTS.filter(s => s.section === 'nav')} />
          </TabsContent>

          {/* Tab: Cell States */}
          <TabsContent value="states" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Each cell shows its current execution state. The state badge and left border update in real-time.
            </p>
            <div className="space-y-2">
              {STATES.map((s, i) => {
                const Icon = s.icon
                return (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
                    <Badge variant={s.variant} className="gap-1 min-w-[130px] justify-center">
                      <Icon className="h-3 w-3" />
                      {s.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{s.desc}</span>
                  </div>
                )
              })}
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Left border colors:</strong></p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-yellow-500" />
                  <span>DSL ready</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-green-500" />
                  <span>Complete</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-red-500" />
                  <span>Error</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab: User Guide */}
          <TabsContent value="guide" className="space-y-4">
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                <strong>Pipeline:</strong> First run turns natural language into <em>NotebookDSL</em> (with parse repair).
                Second run starts the <em>interpreter</em> (generate code per node, verify, run, retry on failures).
                Third run (when offered) executes merged code so you see full stdout/result text — generated source stays hidden.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-green-700 flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  What you CAN do
                </h4>
                <ul className="space-y-1.5">
                  {CAN_DO.map((item, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5 shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-2">
                  <XCircle className="h-3.5 w-3.5" />
                  What you CANNOT do
                </h4>
                <ul className="space-y-1.5">
                  {CANNOT_DO.map((item, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-red-500 mt-0.5 shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground">
              <strong>Example (natural language):</strong>
              <code className="block mt-1 px-3 py-2 bg-muted rounded-md font-mono text-[11px] whitespace-pre-wrap">
                Build a two-step pipeline: first fetch a short quote as text, then count its words.
              </code>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutSection({ title, shortcuts }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1.5">
        {shortcuts.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-1">
              {s.keys.map((k, j) => (
                <span key={j} className="flex items-center gap-1">
                  {j > 0 && <span className="text-muted-foreground text-xs">+</span>}
                  <Kbd>{k}</Kbd>
                </span>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
