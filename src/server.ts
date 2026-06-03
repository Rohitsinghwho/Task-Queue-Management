/**
 * HTTP API + SSE stream for queue stats and events.
 *
 * Exposes:
 * - GET /api/stats: current queue counts
 * - GET /api/stream: server-sent events for live updates
 */
// src/server/index.ts
import express, { Request, Response } from 'express'
import cors from 'cors'
import { eventBus } from './classes/eventBus.js'
import { QueueEvents as QueueEvent } from './interfaces/QueueEvents.js'
import { Queue } from './classes/queue.js'

const app = express()
app.use(cors())
app.use(express.json())

const queue = await Queue.create('myqueue')

// -------------------------------------------------------
// GET /api/stats
// -------------------------------------------------------
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const stats = await queue.getStatus()
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// -------------------------------------------------------
// GET /api/stream — SSE
// -------------------------------------------------------
app.get('/api/stream', (req: Request, res: Response) => {
  // tell browser this is an SSE connection
  res.setHeader('Content-Type',                'text/event-stream')
  res.setHeader('Cache-Control',               'no-cache')
  res.setHeader('Connection',                  'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send a heartbeat every 30s to keep connection alive.
  // Without this, some clients close idle SSE connections.
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 30000)

  console.log('[SSE] client connected')

  // Send initial stats immediately on connect so the UI has a baseline.
  queue.getStatus().then(stats => {
    const event = { type: 'stats', stats }
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  })

  // Forward every queue event to this browser client.
  const listener = (data: QueueEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  eventBus.on('queue', listener)

  // Cleanup when browser disconnects to avoid leaking listeners.
  req.on('close', () => {
    console.log('[SSE] client disconnected')
    clearInterval(heartbeat)
    eventBus.off('queue', listener)
  })
})

// -------------------------------------------------------
// start server
// -------------------------------------------------------
const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  console.log(`[Server] running on http://localhost:${PORT}`)
  console.log(`[Server] SSE stream at http://localhost:${PORT}/api/stream`)
  console.log(`[Server] Stats at http://localhost:${PORT}/api/stats`)
})

export { app }