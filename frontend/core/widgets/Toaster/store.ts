import type { TToastInput, TToastItem, TToastOptions, TToastSubscriber, TToastType } from './spec'

const MAX_VISIBLE_TOASTS = 3
const DEFAULT_DURATION = 2400
const ERROR_DURATION = 3600

const subscribers = new Set<TToastSubscriber>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

let items: TToastItem[] = []
let uid = 0

const cloneItems = (): TToastItem[] => items.map((item) => ({ ...item }))

const notify = (): void => {
  const nextItems = cloneItems()
  subscribers.forEach((subscriber) => subscriber(nextItems))
}

const clearTimer = (id: string): void => {
  const timer = timers.get(id)
  if (!timer) return

  clearTimeout(timer)
  timers.delete(id)
}

const scheduleRemove = (item: TToastItem): void => {
  clearTimer(item.id)
  if (item.duration <= 0) return

  timers.set(
    item.id,
    setTimeout(() => {
      removeToast(item.id)
    }, item.duration),
  )
}

const normalizeInput = (input: TToastInput, type: TToastType = 'info'): TToastOptions => {
  if (typeof input === 'string') {
    return { message: input, type }
  }

  return { ...input, type: input.type ?? type }
}

const makeToast = (option: TToastOptions): TToastItem => {
  const resolvedType = option.type ?? 'info'

  return {
    id: option.id ?? `toast-${Date.now()}-${uid++}`,
    message: option.message,
    type: resolvedType,
    duration: option.duration ?? (resolvedType === 'error' ? ERROR_DURATION : DEFAULT_DURATION),
    createdAt: Date.now(),
  }
}

export const toast = (input: TToastInput, type: TToastType = 'info'): string => {
  if (typeof window === 'undefined') return ''

  const option = normalizeInput(input, type)
  const nextItem = makeToast(option)
  const sameIndex = items.findIndex(
    (item) =>
      item.id === nextItem.id || (item.message === nextItem.message && item.type === nextItem.type),
  )

  if (sameIndex >= 0) {
    const current = items[sameIndex]
    items = [
      ...items.slice(0, sameIndex),
      { ...current, ...nextItem, id: current.id },
      ...items.slice(sameIndex + 1),
    ]
    scheduleRemove(items[sameIndex])
    notify()
    return current.id
  }

  items = [...items, nextItem]

  while (items.length > MAX_VISIBLE_TOASTS) {
    const [removed, ...rest] = items
    clearTimer(removed.id)
    items = rest
  }

  scheduleRemove(nextItem)
  notify()

  return nextItem.id
}

export const removeToast = (id: string): void => {
  const nextItems = items.filter((item) => item.id !== id)
  if (nextItems.length === items.length) return

  clearTimer(id)
  items = nextItems
  notify()
}

export const subscribeToast = (subscriber: TToastSubscriber): (() => void) => {
  subscribers.add(subscriber)
  subscriber(cloneItems())

  return () => {
    subscribers.delete(subscriber)
  }
}
