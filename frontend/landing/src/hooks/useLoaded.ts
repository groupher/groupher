import { useEffect, useState } from 'react'

type TRes = {
  loaded: boolean
}

export default (): TRes => {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return {
    loaded,
  }
}
