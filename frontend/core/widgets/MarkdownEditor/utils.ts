export type TSelectionUpdate = {
  value: string
  start: number
  end: number
}

export const safeValue = (value?: string): string => value ?? ''

export const applyWrap = (
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
): TSelectionUpdate => {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd) || placeholder
  const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(
    selectionEnd,
  )}`
  const start = selectionStart + before.length
  const end = start + selected.length

  return { value: next, start, end }
}

export const applyLinePrefix = (
  textarea: HTMLTextAreaElement,
  prefix: string,
  placeholder: string,
): TSelectionUpdate => {
  const { selectionStart, selectionEnd, value } = textarea
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const hasSelection = selectionStart !== selectionEnd
  const lineEnd = value.indexOf('\n', selectionEnd)
  const blockEnd = hasSelection ? selectionEnd : lineEnd === -1 ? value.length : lineEnd
  const selected = value.slice(lineStart, blockEnd) || placeholder
  const lines = selected.split('\n')
  const nextBlock = lines.map((line) => `${prefix}${line}`).join('\n')
  const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(blockEnd)}`
  const start = lineStart + prefix.length
  const end = lineStart + nextBlock.length

  return { value: next, start, end }
}

export const applyOrderedList = (
  textarea: HTMLTextAreaElement,
  placeholder: string,
): TSelectionUpdate => {
  const { selectionStart, selectionEnd, value } = textarea
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const hasSelection = selectionStart !== selectionEnd
  const lineEnd = value.indexOf('\n', selectionEnd)
  const blockEnd = hasSelection ? selectionEnd : lineEnd === -1 ? value.length : lineEnd
  const selected = value.slice(lineStart, blockEnd) || placeholder
  const lines = selected.split('\n')
  const nextBlock = lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
  const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(blockEnd)}`
  const start = lineStart + 3
  const end = lineStart + nextBlock.length

  return { value: next, start, end }
}
