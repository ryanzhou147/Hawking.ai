import { useEffect, useCallback } from 'react'
import { useGridStore } from '../stores/useGridStore'
import { useClenchStore } from '../stores/useClenchStore'

interface UseKeyboardSimulationOptions {
  enabled?: boolean
  onAction?: (action: 'right' | 'down' | 'refresh') => void
}

export function useKeyboardSimulation(options: UseKeyboardSimulationOptions = {}) {
  const { enabled = true, onAction } = options

  const moveRight = useGridStore((state) => state.moveRight)
  const moveDown = useGridStore((state) => state.moveDown)
  const refreshGrid = useGridStore((state) => state.refreshGrid)
  const triggerClench = useClenchStore((state) => state.triggerClench)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Prevent default for our keys
    if (['1', '2', '3', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
    }

    switch (event.key) {
      case '1':
      case 'ArrowRight':
        triggerClench(1)
        moveRight()
        onAction?.('right')
        break

      case '2':
      case 'ArrowDown':
        triggerClench(2)
        moveDown()
        onAction?.('down')
        break

      case '3':
        triggerClench(3)
        refreshGrid()
        onAction?.('refresh')
        break
    }
  }, [enabled, moveRight, moveDown, refreshGrid, triggerClench, onAction])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])

  return { enabled }
}
