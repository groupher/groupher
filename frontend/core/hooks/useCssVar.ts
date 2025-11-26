import { useEffect, useState } from 'react'
import useTheme from '~/hooks/useTheme'

export default function useCSSVar(name: string, deps?: any[]): string {
  const { theme } = useTheme()
  const [val, setVal] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const el = document.querySelector('[data-theme]')
    if (!el) return

    const computed = getComputedStyle(el).getPropertyValue(`--${name}`).trim()
    setVal(computed)
  }, [theme, ...(deps || []), name])

  return val
}
