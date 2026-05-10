export type TSelectionUpdate = {
  value: string
  start: number
  end: number
}

const TASK_LIST_RE = /^(\s*)([-*+])\s+\[( |x|X)\]\s+(.*)$/
const UNORDERED_LIST_RE = /^(\s*)([-*+])\s+(.*)$/
const ORDERED_LIST_RE = /^(\s*)(\d+)([.)])\s+(.*)$/

export const safeValue = (value?: string): string => value ?? ''

const buildUpdate = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string,
  content: string,
): TSelectionUpdate => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const beforeLine = value.slice(0, lineStart)
  const afterSelection = value.slice(selectionEnd)

  if (content.trim() === '') {
    const next = `${beforeLine}${afterSelection}`
    return { value: next, start: lineStart, end: lineStart }
  }

  const insert = `\n${marker}`
  const next = `${value.slice(0, selectionStart)}${insert}${afterSelection}`
  const cursor = selectionStart + insert.length

  return { value: next, start: cursor, end: cursor }
}

export const continueListOnEnter = (textarea: HTMLTextAreaElement): TSelectionUpdate | null => {
  const { selectionStart, selectionEnd, value } = textarea

  if (selectionStart !== selectionEnd) return null

  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const currentLine = value.slice(lineStart, selectionStart)

  const taskMatch = currentLine.match(TASK_LIST_RE)
  if (taskMatch) {
    const [, indent, bullet, , content] = taskMatch
    return buildUpdate(value, selectionStart, selectionEnd, `${indent}${bullet} [ ] `, content)
  }

  const orderedMatch = currentLine.match(ORDERED_LIST_RE)
  if (orderedMatch) {
    const [, indent, order, delimiter, content] = orderedMatch
    const nextOrder = Number(order) + 1
    return buildUpdate(
      value,
      selectionStart,
      selectionEnd,
      `${indent}${nextOrder}${delimiter} `,
      content,
    )
  }

  const unorderedMatch = currentLine.match(UNORDERED_LIST_RE)
  if (unorderedMatch) {
    const [, indent, bullet, content] = unorderedMatch
    return buildUpdate(value, selectionStart, selectionEnd, `${indent}${bullet} `, content)
  }

  return null
}

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
