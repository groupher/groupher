// hooks/useEvent.ts
import { useEffect } from 'react'

import PubSub from '~/utils/pubsub'

export default <T>(
  eventName: string | symbol,
  callback: (message: string | symbol, data?: T) => void,
  dependencies: any[] = [],
) => {
  useEffect(() => {
    const handler = (msg: string | symbol, data?: T) => {
      callback(msg, data)
    }

    const token = PubSub.subscribe(eventName, handler)

    return () => {
      PubSub.unsubscribe(token)
    }
  }, [eventName, ...dependencies])
}
