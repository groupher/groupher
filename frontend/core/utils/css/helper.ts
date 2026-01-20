export const getCSSVar = (key: string): string | null => {
  if (typeof window === 'undefined') return null

  const root = document.documentElement
  const val = getComputedStyle(root).getPropertyValue(`--${key}`).trim()
  if (val) return val

  const val2 = getComputedStyle(document.body).getPropertyValue(`--${key}`).trim()
  return val2 || null
}

export const setGlobalCSSVar = (key: string, value: string) => {
  if (typeof window === 'undefined') return
  document.documentElement.style.setProperty(`--${key}`, value)
}
