import { useState, useEffect } from 'react'
import { Plus, Activity } from 'lucide-react'
import { NotebookCell } from './components/NotebookCell'
import { Button } from './components/Button'
import { Card, CardContent, CardHeader, CardTitle } from './components/Card'

const API_BASE_URL = '/api'

function App() {
  const [cells, setCells] = useState([{ id: 1 }])
  const [cellCounter, setCellCounter] = useState(1)
  const [apiStatus, setApiStatus] = useState({ status: 'checking', message: '' })

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      const data = await response.json()
      
      if (data.status === 'healthy') {
        setApiStatus({
          status: 'healthy',
          message: data.litellm_available && data.vllm_configured 
            ? 'Connected to vLLM' 
            : 'API ready (configure vLLM)'
        })
      } else {
        setApiStatus({ status: 'error', message: 'API unhealthy' })
      }
    } catch (error) {
      setApiStatus({ status: 'error', message: 'Cannot connect to backend' })
    }
  }

  // Check API health on mount
  useEffect(() => {
    checkApiHealth()
  }, [])

  const addCell = () => {
    const newId = cellCounter + 1
    setCellCounter(newId)
    setCells([...cells, { id: newId }])
  }

  const deleteCell = (cellId) => {
    if (cells.length > 1) {
      setCells(cells.filter(cell => cell.id !== cellId))
    }
  }

  const runCell = async (input) => {
    try {
      const response = await fetch(`${API_BASE_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to process text')
      }

      return await response.json()
    } catch (error) {
      throw new Error(error.message || 'Network error')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-border animate-slide-down">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-xl animate-pulse">
              ℒℒ
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
                LLM Notebook
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                Interactive Computing with LLMs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
              apiStatus.status === 'healthy' 
                ? 'border-green-500/20 bg-green-500/10' 
                : apiStatus.status === 'error'
                ? 'border-red-500/20 bg-red-500/10'
                : 'border-border bg-muted'
            }`}>
              <Activity className={`h-4 w-4 ${
                apiStatus.status === 'healthy' ? 'text-green-500' : 'text-red-500'
              }`} />
              <span className="text-xs font-mono">{apiStatus.message}</span>
            </div>
          </div>
        </header>

        {/* Info Panel */}
        <Card className="mb-6 animate-float-in">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              📘 About This Notebook
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This interactive notebook processes text through two phases:{' '}
              <strong className="text-foreground">(1)</strong> Translation to lowercase using an LLM,
              and <strong className="text-foreground">(2)</strong> Balloon interpretation - generating
              a balloon image for each occurrence of the word "balloon".
            </p>
            <p>
              Try phrases like{' '}
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono text-primary">
                "I love BALLOONS! Red balloon, blue balloon."
              </code>
            </p>
            <p className="text-xs pt-2 border-t border-border">
              💡 Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Shift+Enter</kbd> to run a cell
            </p>
          </CardContent>
        </Card>

        {/* Notebook Cells */}
        <div className="space-y-6 mb-6">
          {cells.map((cell) => (
            <NotebookCell
              key={cell.id}
              cellId={cell.id}
              onDelete={deleteCell}
              onRun={runCell}
            />
          ))}
        </div>

        {/* Add Cell Button */}
        <div className="flex justify-center">
          <Button
            onClick={addCell}
            size="lg"
            className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
          >
            <Plus className="h-5 w-5" />
            Add New Cell
          </Button>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground font-mono">
          <p>LLM Notebook • Powered by FastAPI + vLLM + React</p>
        </footer>
      </div>
    </div>
  )
}

export default App
