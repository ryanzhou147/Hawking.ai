import { useEffect, useCallback } from 'react'
import { useGridStore } from '../stores/useGridStore'
import { useClenchStore } from '../stores/useClenchStore'

interface UseKeyboardSimulationOptions {
  enabled?: boolean
  onAction?: (action: 'right' | 'down' | 'select') => void
  onSelect?: () => void  // Called when 3 is pressed (select)
}

export function useKeyboardSimulation(options: UseKeyboardSimulationOptions = {}) {
  const { enabled = true, onAction, onSelect } = options

  const moveRight = useGridStore((state) => state.moveRight)
  const moveDown = useGridStore((state) => state.moveDown)
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
        // 3 clenches = select current word (or trigger refresh if on refresh button)
        triggerClench(3)
        onSelect?.()
        onAction?.('select')
        break
    }
  }, [enabled, moveRight, moveDown, triggerClench, onAction, onSelect])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])

  return { enabled }
}
