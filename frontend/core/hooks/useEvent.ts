// hooks/useEvent.ts
import { type DependencyList, useEffect } from 'react'

import PubSub from '~/utils/pubsub'

export default <T>(
  eventName: string | symbol,
  callback: (message: string | symbol, data?: T) => void,
  dependencies: DependencyList = [],
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
