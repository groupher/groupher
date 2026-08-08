import type { WidgetBootConfig, WidgetPageContext, WidgetView } from '../app/state'

export type WidgetCommand =
  | { name: 'boot'; config: WidgetBootConfig }
  | { name: 'open'; view?: WidgetView }
  | { name: 'close' }
  | { name: 'toggle' }
  | { name: 'update'; context: WidgetPageContext }
  | { name: 'shutdown' }

export type WidgetRuntime = {
  dispatch: (command: WidgetCommand) => void
}

export type GroupherWidgetApi = {
  (...args: unknown[]): void
  q?: ArrayLike<unknown>[]
}

export type WidgetLoaderState = {
  api: GroupherWidgetApi
  runtimeBaseUrl: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (value === 1) return true
  if (value === 0) return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on'
    ) {
      return true
    }
    if (
      normalized === '0' ||
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'off'
    ) {
      return false
    }
  }

  return undefined
}

const readBootConfig = (value: unknown): WidgetBootConfig | null => {
  if (!isRecord(value) || typeof value.widgetKey !== 'string' || value.widgetKey.trim() === '') {
    return null
  }

  const position = value.position
  if (position !== undefined && position !== 'bottom-left' && position !== 'bottom-right') {
    return null
  }

  const mock = parseBoolean(value.mock)
  if (value.mock !== undefined && mock === undefined) return null

  return {
    widgetKey: value.widgetKey.trim(),
    ...(position ? { position } : {}),
    ...(mock === undefined ? {} : { mock }),
  }
}

const readPageContext = (value: unknown): WidgetPageContext | null => {
  if (!isRecord(value)) return null

  const { title, url } = value
  if (title !== undefined && typeof title !== 'string') return null
  if (url !== undefined && typeof url !== 'string') return null
  if (title === undefined && url === undefined) return null

  return {
    ...(title === undefined ? {} : { title }),
    ...(url === undefined ? {} : { url }),
  }
}

/**
 * Parse and validate one public Widget command at the untyped script boundary.
 */
export const parseWidgetCommand = (args: ArrayLike<unknown>): WidgetCommand | null => {
  const [name, payload] = Array.from(args)

  switch (name) {
    case 'boot': {
      const config = readBootConfig(payload)
      return config ? { name, config } : null
    }
    case 'open': {
      if (payload === undefined) return { name }
      if (!isRecord(payload)) return null
      const view = payload.view
      if (
        view !== undefined &&
        view !== 'home' &&
        view !== 'posts' &&
        view !== 'changelog' &&
        view !== 'docs' &&
        view !== 'feedback'
      ) {
        return null
      }
      return { name, ...(view ? { view } : {}) }
    }
    case 'close':
    case 'toggle':
    case 'shutdown':
      return { name }
    case 'update': {
      const context = readPageContext(payload)
      return context ? { name, context } : null
    }
    default:
      return null
  }
}

/**
 * Recover valid commands captured by the pre-loader queue stub.
 */
export const readQueuedCommands = (api: GroupherWidgetApi | undefined): WidgetCommand[] =>
  Array.from(api?.q ?? []).flatMap((args) => {
    const command = parseWidgetCommand(args)
    return command ? [command] : []
  })
