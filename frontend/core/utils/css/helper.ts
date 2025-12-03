export const getCSSVar = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  const val = getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim()
  return val || null
}

export const setGlobalCSSVar = (key: string, value: string) => {
  if (typeof window === 'undefined') return
  document.documentElement.style.setProperty(`--${key}`, value)
}
