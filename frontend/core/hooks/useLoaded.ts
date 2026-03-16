import { useEffect, useState } from 'react'

type TRes = {
  loaded: boolean
}

export default function useLoaded(): TRes {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return {
    loaded,
  }
}
