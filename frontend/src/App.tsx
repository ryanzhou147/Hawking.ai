import { Layout } from './components/Layout'
import { WordGrid } from './components/WordGrid'
import { ChatPanel } from './components/ChatPanel'
import { ActionIndicators } from './components/ActionIndicators'
import { useKeyboardSimulation } from './hooks/useKeyboardSimulation'

function App() {
  // Enable keyboard simulation for dev mode
  useKeyboardSimulation({ enabled: true })

  return (
    <Layout
      devMode={true}
      leftPanel={<WordGrid />}
      rightPanel={<ChatPanel />}
      bottomBar={<ActionIndicators />}
    />
  )
}

export default App
