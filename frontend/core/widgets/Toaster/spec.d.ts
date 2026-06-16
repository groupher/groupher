export type TToastType = 'info' | 'success' | 'error'

export type TToastOptions = {
  id?: string
  message: string
  type?: TToastType
  duration?: number
}

export type TToastInput = string | TToastOptions

export type TToastItem = {
  id: string
  message: string
  type: TToastType
  duration: number
  createdAt: number
}

export type TToastSubscriber = (items: TToastItem[]) => void
