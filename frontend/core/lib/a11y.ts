import type { KeyboardEvent } from 'react'

export const createKeyboardClick =
  <T extends HTMLElement>(onClick: () => void) =>
  (event: KeyboardEvent<T>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onClick()
  }
