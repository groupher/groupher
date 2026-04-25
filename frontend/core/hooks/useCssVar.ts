import { type DependencyList, useEffect, useState } from 'react'
import useTheme from '~/hooks/useTheme'

type TOptions = {
  selector?: string
}

export default function useCSSVar(name: string, deps?: DependencyList, options?: TOptions): string {
  const { theme } = useTheme()
  const [val, setVal] = useState('')
  const selector = options?.selector || '[data-theme]'

  useEffect(() => {
    if (typeof window === 'undefined') return

    const el = document.querySelector(selector)
    if (!el) return
    const root = document.documentElement

    const readVar = () => {
      const computed = getComputedStyle(el).getPropertyValue(`--${name}`).trim()
      setVal(computed)
    }

    readVar()

    const observer = new MutationObserver(() => readVar())
    const observeOptions: MutationObserverInit = {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    }

    observer.observe(el, observeOptions)
    if (root !== el) {
      observer.observe(root, observeOptions)
    }

    return () => observer.disconnect()
  }, [theme, name, selector, ...(deps || [])])

  return val
}
