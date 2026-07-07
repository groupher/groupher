// ~/hooks/useDidMount.ts
import { useEffect, useState } from 'react'

/**
 * Returns true only after the component has mounted on the client.
 *
 * Use this when a render branch depends on browser-only APIs but should still
 * produce deterministic markup during SSR/hydration.
 */
export default function useDidMount(): boolean {
  const [didMount, setDidMount] = useState(false)

  useEffect(() => {
    setDidMount(true)
  }, [])

  return didMount
}
