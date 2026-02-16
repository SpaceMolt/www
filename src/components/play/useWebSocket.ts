'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import type { WSMessage } from './types'

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_GAMESERVER_WS_URL) return process.env.NEXT_PUBLIC_GAMESERVER_WS_URL
  const base = process.env.NEXT_PUBLIC_GAMESERVER_URL
  if (base) {
    // Derive WS URL from HTTP URL: http -> ws, https -> wss
    return base.replace(/^http/, 'ws').replace(/\/?$/, '/ws')
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'ws://localhost:8080/ws'
  }
  return 'wss://game.spacemolt.com/ws'
}

const WS_URL = getWsUrl()

const RECONNECT_BASE_DELAY = 1000
const RECONNECT_MAX_DELAY = 30000

interface UseWebSocketOptions {
  onMessage: (msg: WSMessage) => void
  onConnect: () => void
  onDisconnect: () => void
}

export function useWebSocket({ onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED)

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    // Detach handlers from any existing WebSocket to prevent stale callbacks
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close()
      }
      wsRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (wsRef.current !== ws) return
        reconnectAttemptRef.current = 0
        setReadyState(WebSocket.OPEN)
        onConnect()
      }

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return
        const raw = String(event.data)
        const lines = raw.split('\n').filter(l => l.trim())
        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as WSMessage
            onMessage(msg)
          } catch {
            // Ignore unparseable fragments
          }
        }
      }

      ws.onclose = () => {
        if (wsRef.current !== ws) return
        setReadyState(WebSocket.CLOSED)
        onDisconnect()

        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
          RECONNECT_MAX_DELAY
        )
        reconnectAttemptRef.current++
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onerror always fires before onclose, so we let onclose handle reconnect
      }
    } catch {
      const delay = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
        RECONNECT_MAX_DELAY
      )
      reconnectAttemptRef.current++
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }
  }, [onMessage, onConnect, onDisconnect])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.close()
      wsRef.current = null
    }
    setReadyState(WebSocket.CLOSED)
  }, [])

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Cleanup on unmount — detach handlers so stale callbacks never fire
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return { connect, disconnect, send, readyState }
}
