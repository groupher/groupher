const FILL_CLASS_PREFIX = 'fill-'
const TEXT_CLASS_PREFIX = 'text-'

const toTextColorClass = (className: string): string => {
  const segments = className.split(':')
  const lastIndex = segments.length - 1
  const colorClass = segments[lastIndex]

  if (!colorClass.startsWith(FILL_CLASS_PREFIX)) return className

  const colorKey = colorClass.slice(FILL_CLASS_PREFIX.length)
  const textColorKey = colorKey.startsWith(TEXT_CLASS_PREFIX)
    ? colorKey.slice(TEXT_CLASS_PREFIX.length)
    : colorKey

  segments[lastIndex] = `${TEXT_CLASS_PREFIX}${textColorKey}`

  return segments.join(':')
}

export const getDsbIconClassName = (className?: string): string | undefined => {
  if (!className) return undefined

  return className.split(/\s+/).filter(Boolean).map(toTextColorClass).join(' ')
}
