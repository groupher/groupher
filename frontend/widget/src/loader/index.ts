import {
  parseWidgetCommand,
  readQueuedCommands,
  type GroupherWidgetApi,
  type WidgetCommand,
  type WidgetRuntime,
} from './commandQueue'

const RUNTIME_ASSET_PATH =
  typeof __WIDGET_RUNTIME_ASSET_PATH__ === 'string' ? __WIDGET_RUNTIME_ASSET_PATH__ : '/src/main.ts'

const reportError = (message: string, cause?: unknown): void => {
  console.error(`[Groupher Widget] ${message}`, cause)
  window.dispatchEvent(
    new CustomEvent('groupher-widget:error', {
      detail: { cause, message },
    }),
  )
}

const resolveRuntimeBaseUrl = (): string => {
  if (window.__groupherWidgetRuntimeBaseUrl) {
    return window.__groupherWidgetRuntimeBaseUrl
  }

  const script = document.currentScript
  return new URL(
    '.',
    script instanceof HTMLScriptElement && script.src ? script.src : window.location.href,
  ).href
}

const readScriptBootCommand = (): WidgetCommand | null => {
  const script = document.currentScript
  if (!(script instanceof HTMLScriptElement)) return null

  return parseWidgetCommand([
    'boot',
    {
      position: script.dataset.position,
      widgetKey: script.dataset.widgetKey,
      mock: script.dataset.mock,
    },
  ])
}

const installLoader = (): void => {
  if (window.__groupherWidgetLoaderState) return

  const previousApi = window.GroupherWidget
  const queuedCommands = readQueuedCommands(previousApi)
  const scriptBootCommand = readScriptBootCommand()
  const runtimeBaseUrl = resolveRuntimeBaseUrl()
  const runtimeNonce =
    document.currentScript instanceof HTMLScriptElement ? document.currentScript.nonce : ''
  let runtimePromise: Promise<WidgetRuntime> | null = null
  let commandChain = Promise.resolve()

  const loadRuntime = (): Promise<WidgetRuntime> => {
    if (runtimePromise) return runtimePromise

    const attempt = new Promise<WidgetRuntime>((resolve, reject) => {
      if (window.__groupherWidgetCreateRuntime) {
        resolve(window.__groupherWidgetCreateRuntime())
        return
      }

      const script = document.createElement('script')
      const cleanup = (): void => {
        script.onload = null
        script.onerror = null
        script.remove()
      }

      script.async = true
      script.crossOrigin = 'anonymous'
      script.dataset.groupherWidgetRuntime = ''
      if (runtimeNonce) script.nonce = runtimeNonce
      script.src = new URL(RUNTIME_ASSET_PATH, runtimeBaseUrl).href
      script.type = 'module'
      script.onload = () => {
        const createRuntime = window.__groupherWidgetCreateRuntime
        cleanup()
        if (!createRuntime) {
          reject(new Error('The Widget runtime loaded without registering its factory.'))
          return
        }
        resolve(createRuntime())
      }
      script.onerror = () => {
        cleanup()
        reject(new Error(`Unable to load the Widget runtime from ${script.src}.`))
      }
      document.head.append(script)
    })

    runtimePromise = attempt.catch((error: unknown) => {
      runtimePromise = null
      throw error
    })
    return runtimePromise
  }

  const dispatch = (command: WidgetCommand): void => {
    commandChain = commandChain
      .then(async () => {
        const runtime = await loadRuntime()
        runtime.dispatch(command)
      })
      .catch((error: unknown) => {
        reportError(`Unable to run \`${command.name}\`.`, error)
      })
  }

  const api: GroupherWidgetApi = (...args: unknown[]) => {
    const command = parseWidgetCommand(args)
    if (!command) {
      reportError('Ignored an invalid command.', args)
      return
    }
    dispatch(command)
  }

  window.GroupherWidget = api
  window.__groupherWidgetLoaderState = { api, runtimeBaseUrl }

  if (scriptBootCommand) dispatch(scriptBootCommand)
  for (const command of queuedCommands) dispatch(command)
}

installLoader()
