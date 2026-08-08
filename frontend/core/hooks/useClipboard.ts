import { useCallback, useState } from 'react'

export type TCopyToClipboardState = {
  value?: string
  error?: Error
}

const copyWithSelection = (value: string): void => {
  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textArea)

  if (!copied) throw new Error('Unable to copy text')
}

const useClipboard = (): [TCopyToClipboardState, (value: string) => Promise<void>] => {
  const [state, setState] = useState<TCopyToClipboardState>({})

  const copy = useCallback(async (value: string): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        copyWithSelection(value)
      }
      setState({ value })
    } catch (error) {
      setState({ error: error instanceof Error ? error : new Error(String(error)) })
    }
  }, [])

  return [state, copy]
}

export default useClipboard
