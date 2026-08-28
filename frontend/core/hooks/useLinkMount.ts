import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

export default (loader: () => void) => {
  const { pathname, searchStr } = useLocation()

  const isInitialMount = useRef(true)
  const loaderRef = useRef(loader)

  loaderRef.current = loader

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    loaderRef.current?.()
  }, [pathname, searchStr])
}
