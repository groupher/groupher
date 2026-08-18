import { useEffect, useState } from 'react'

type TRes = {
  loaded: boolean
}

/** Exposes loaded state and actions through the shared React hook boundary. */
export default function useLoaded(): TRes {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return {
    loaded,
  }
}
