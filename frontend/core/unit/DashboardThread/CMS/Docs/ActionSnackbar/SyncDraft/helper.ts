export const formatSavedTime = (value?: string | null): string => {
  if (!value) return 'Save time unavailable'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Save time unavailable'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(date)
    .replace(',', '')
}
