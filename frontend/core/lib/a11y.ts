import type { KeyboardEvent } from 'react'

/** Creates keyboard click from typed frontend shared inputs. */
export const createKeyboardClick =
  <T extends HTMLElement>(onClick: () => void) =>
  (event: KeyboardEvent<T>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onClick()
  }
