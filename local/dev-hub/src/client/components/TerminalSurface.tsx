import type { TServiceLog } from '@shared/contracts'
import { useEffect, useRef } from 'react'

import { fetchServiceLogs, subscribeServiceLogs } from '@/lib/hub-client'

type TProps = {
  serviceId: string
  mode: 'preview' | 'full'
  emptyText: string
}

export function TerminalSurface({ serviceId, mode, emptyText }: TProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const controller = new AbortController()
    let disposed = false
    let disposeTerminal = () => undefined

    void Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      mode === 'full' ? import('@xterm/addon-web-links') : Promise.resolve(null),
    ])
      .then(async ([{ Terminal }, { FitAddon }, webLinksModule]) => {
        if (disposed) return

        const styles = getComputedStyle(host)
        const background = styles.getPropertyValue('--terminal').trim() || '#191a1b'
        const foreground =
          styles.getPropertyValue('--service-monogram-foreground').trim() || '#d7d7d3'

        const terminal = new Terminal({
          allowTransparency: true,
          convertEol: true,
          cursorBlink: false,
          disableStdin: true,
          fontFamily: '"Berkeley Mono", "SFMono-Regular", Consolas, monospace',
          fontSize: mode === 'preview' ? 11 : 13,
          lineHeight: mode === 'preview' ? 1.25 : 1.35,
          scrollback: mode === 'preview' ? 0 : 5_000,
          theme: {
            background,
            foreground,
            cursor: foreground,
            black: '#202123',
            red: '#ff7070',
            green: '#9ad17b',
            yellow: '#f4c76c',
            blue: '#82a7ff',
            magenta: '#d8a0ff',
            cyan: '#7bd6d0',
            white: '#f4f4ef',
            brightBlack: '#a7a8a3',
          },
        })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        if (webLinksModule) terminal.loadAddon(new webLinksModule.WebLinksAddon())
        terminal.open(host)

        let lastSeq = 0
        let runId: string | null = null
        let hasLogs = false
        let hydrated = false
        const pending: TServiceLog[] = []

        const writeLog = (log: TServiceLog) => {
          if (log.runId !== runId) {
            terminal.reset()
            runId = log.runId
            lastSeq = 0
            hasLogs = false
          }
          if (log.seq <= lastSeq) return
          if (!hasLogs) terminal.reset()
          terminal.write(log.chunk)
          lastSeq = log.seq
          hasLogs = true
        }

        const unsubscribe = subscribeServiceLogs(serviceId, (log) => {
          if (hydrated) writeLog(log)
          else pending.push(log)
        })

        const fit = () => {
          if (!disposed && host.clientWidth > 0 && host.clientHeight > 0) fitAddon.fit()
        }
        const observer = new ResizeObserver(fit)
        observer.observe(host)
        requestAnimationFrame(fit)

        disposeTerminal = () => {
          unsubscribe()
          observer.disconnect()
          terminal.dispose()
        }

        try {
          const logs = await fetchServiceLogs(serviceId, controller.signal)
          if (disposed) return
          for (const log of logs) writeLog(log)
          hydrated = true
          for (const log of pending) writeLog(log)
          pending.length = 0
        } catch {
          hydrated = true
        }

        if (disposed) return
        if (!hasLogs) terminal.write(emptyText)
      })
      .catch((error: unknown) => {
        if (disposed) return
        console.error('Failed to load terminal surface.', error)
        host.textContent = 'Terminal renderer unavailable.'
      })

    return () => {
      disposed = true
      controller.abort()
      disposeTerminal()
    }
  }, [emptyText, mode, serviceId])

  return <div ref={hostRef} className={`terminal-surface terminal-surface--${mode}`} />
}
