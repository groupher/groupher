import { useEffect, useRef } from 'react'

import { usePathname, useSearchParams } from '~/platform'

export default (loader: () => void) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isInitialMount = useRef(true)
  const loaderRef = useRef(loader)

  loaderRef.current = loader

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    loaderRef.current?.()
  }, [pathname, searchParams])
}
