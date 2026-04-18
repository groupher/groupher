import { useEffect, useState } from 'react'
import useTheme from '~/hooks/useTheme'

type TOptions = {
  selector?: string
}

export default function useCSSVar(name: string, deps?: any[], options?: TOptions): string {
  const { theme } = useTheme()
  const [val, setVal] = useState('')
  const selector = options?.selector || '[data-theme]'

  useEffect(() => {
    if (typeof window === 'undefined') return

    const el = document.querySelector(selector)
    if (!el) return

    const readVar = () => {
      const computed = getComputedStyle(el).getPropertyValue(`--${name}`).trim()
      setVal(computed)
    }

    readVar()

    const observer = new MutationObserver(() => readVar())
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    })

    return () => observer.disconnect()
  }, [theme, name, selector, ...(deps || [])])

  return val
}
