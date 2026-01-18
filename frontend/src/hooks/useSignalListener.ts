import { useEffect, useCallback, useRef } from 'react'
import { useGridStore } from '../stores/useGridStore'
import { useClenchStore } from '../stores/useClenchStore'

interface UseSignalListenerOptions {
  enabled?: boolean
  onAction?: (action: 'right' | 'down' | 'select') => void
  onSelect?: () => void
}

export function useSignalListener(options: UseSignalListenerOptions = {}) {
  const { enabled = true, onAction, onSelect } = options

  const moveRight = useGridStore((state) => state.moveRight)
  const moveDown = useGridStore((state) => state.moveDown)
  const triggerClench = useClenchStore((state) => state.triggerClench)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const isConnectingRef = useRef(false)
  const lastRightTimeRef = useRef(0)
  const lastDownTimeRef = useRef(0)
  const lastSelectTimeRef = useRef(0)

  const handleSignal = useCallback((action: string) => {
    console.log(`Signal received: ${action}`)

    const now = Date.now()
    const cooldownMs = 200

    switch (action.toUpperCase()) {
      case 'RIGHT':
        if (now - lastRightTimeRef.current < cooldownMs) {
          console.log('RIGHT ignored due to cooldown')
          return
        }
        lastRightTimeRef.current = now
        // Same as pressing ArrowRight or '1'
        triggerClench(1)
        moveRight()
        onAction?.('right')
        break

      case 'DOWN':
        if (now - lastDownTimeRef.current < cooldownMs) {
          console.log('DOWN ignored due to cooldown')
          return
        }
        lastDownTimeRef.current = now
        // Same as pressing ArrowDown or '2'
        triggerClench(2)
        moveDown()
        onAction?.('down')
        break

      case 'SELECT':
        if (now - lastSelectTimeRef.current < cooldownMs) {
          console.log('SELECT ignored due to cooldown')
          return
        }
        lastSelectTimeRef.current = now
        // Same as pressing '3'
        triggerClench(3)
        onSelect?.()
        onAction?.('select')
        break

      default:
        console.warn(`Unknown signal action: ${action}`)
    }
  }, [moveRight, moveDown, triggerClench, onAction, onSelect])

  useEffect(() => {
    if (!enabled) return

    const wsUrl = 'ws://localhost:8000/ws/signals'
    let pingInterval: number | null = null

    const connect = () => {
      if (wsRef.current && (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      )) {
        return
      }
      if (isConnectingRef.current) {
        return
      }

      console.log(`Connecting to signal WebSocket: ${wsUrl}`)

      try {
        isConnectingRef.current = true
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('Signal WebSocket connected')
          isConnectingRef.current = false
          if (reconnectTimeoutRef.current !== null) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.action) {
              handleSignal(data.action)
            }
          } catch (e) {
            if (event.data !== 'pong') {
              console.warn('Failed to parse WebSocket message:', event.data)
            }
          }
        }

        ws.onclose = () => {
          console.log('Signal WebSocket disconnected, reconnecting in 2s...')
          wsRef.current = null
          isConnectingRef.current = false
          if (enabled) {
            reconnectTimeoutRef.current = window.setTimeout(connect, 2000)
          }
        }

        ws.onerror = (error) => {
          console.error('Signal WebSocket error:', error)
          isConnectingRef.current = false
        }

        wsRef.current = ws

        pingInterval = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 30000)
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        isConnectingRef.current = false
        reconnectTimeoutRef.current = window.setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      if (pingInterval !== null) {
        clearInterval(pingInterval)
      }
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, handleSignal])

  return { enabled }
}
