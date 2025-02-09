/* eslint-disable */
/**
 * Copyright (c) 2010,2011,2012,2013,2014 Morgan Roderick http://roderick.dk
 * License: MIT - http://mrgnrdrck.mit-license.org
 *
 * https://github.com/mroderick/PubSubJS
 */

type TMessage = string | symbol
type TToken = string
type TSubscriber = (message: TMessage, data?: any) => void
type TMessages = Record<string, Record<TToken, TSubscriber>>

const PubSub = {
  immediateExceptions: false,
  publish: (message: TMessage, data?: any): boolean =>
    publish(message, data, false, PubSub.immediateExceptions),
  publishSync: (message: TMessage, data?: any): boolean =>
    publish(message, data, true, PubSub.immediateExceptions),
  subscribe: (message: TMessage, func: TSubscriber): TToken | false => {
    if (typeof func !== 'function') {
      return false
    }

    message = typeof message === 'symbol' ? message.toString() : message

    // message is not registered yet
    if (!Object.prototype.hasOwnProperty.call(messages, message)) {
      messages[message] = {}
    }

    // forcing token as String, to allow for future expansions without breaking usage
    // and allow for easy use as key names for the 'messages' object
    const token = `uid_${String((lastUid += 1))}`
    messages[message][token] = func

    // return token for unsubscribing
    return token
  },
  subscribeAll: (func: TSubscriber): TToken | false => PubSub.subscribe(ALL_SUBSCRIBING_MSG, func),
  subscribeOnce: (message: TMessage, func: TSubscriber): typeof PubSub => {
    const token = PubSub.subscribe(message, function (...args: any[]) {
      // before func apply, unsubscribe message
      PubSub.unsubscribe(token)
      func.apply(this, args)
    })
    return PubSub
  },
  clearAllSubscriptions: (): void => {
    messages = {}
  },
  clearSubscriptions: (topic: string): void => {
    for (const m in messages) {
      if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0) {
        delete messages[m]
      }
    }
  },
  countSubscriptions: (topic: string): number => {
    let count = 0
    for (const m in messages) {
      if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0) {
        for (const _ in messages[m]) {
          count++
        }
        break
      }
    }
    return count
  },
  getSubscriptions: (topic: string): string[] => {
    const list: string[] = []
    for (const m in messages) {
      if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0) {
        list.push(m)
      }
    }
    return list
  },
  unsubscribe: (value: TToken | TSubscriber | string): TToken | boolean => {
    const descendantTopicExists = (topic: string): boolean => {
      for (const m in messages) {
        if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0) {
          // a descendant of the topic exists:
          return true
        }
      }

      return false
    }

    const isTopic =
      typeof value === 'string' &&
      (Object.prototype.hasOwnProperty.call(messages, value) || descendantTopicExists(value))
    const isToken = !isTopic && typeof value === 'string'
    const isFunction = typeof value === 'function'
    let result: TToken | boolean = false

    if (isTopic) {
      PubSub.clearSubscriptions(value)
      return result
    }

    for (const m in messages) {
      if (Object.prototype.hasOwnProperty.call(messages, m)) {
        const message = messages[m]

        if (isToken && message[value]) {
          delete message[value]
          result = value
          // tokens are unique, so we can just stop here
          break
        }

        if (isFunction) {
          for (const t in message) {
            if (Object.prototype.hasOwnProperty.call(message, t) && message[t] === value) {
              delete message[t]
              result = true
            }
          }
        }
      }
    }

    return result
  },
}

let messages: TMessages = {}
let lastUid = -1
const ALL_SUBSCRIBING_MSG = '*'

/**
 * Check if an object has any keys
 * @param { Object } obj The object to check
 * @returns { Boolean }
 */
function hasKeys(obj: Record<string, any>): boolean {
  let key

  // eslint-disable-next-line no-restricted-syntax
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return true
    }
  }
  return false
}

/**
 * Returns a function that throws the passed exception, for use as argument for setTimeout
 * @alias throwException
 * @function
 * @param { Object } ex An Error object
 */
function throwException(ex: Error): () => void {
  return function reThrowException() {
    throw ex
  }
}

/**
 * Call a subscriber function, catching any exceptions and rethrowing them asynchronously
 * @param { Function } subscriber The subscriber function
 * @param { String } message The message
 * @param { * } data The data passed to the subscriber
 */
function callSubscriberWithDelayedExceptions(
  subscriber: TSubscriber,
  message: TMessage,
  data?: any,
): void {
  try {
    subscriber(message, data)
  } catch (ex) {
    setTimeout(throwException(ex), 0)
  }
}

/**
 * Call a subscriber function, allowing exceptions to propagate
 * @param { Function } subscriber The subscriber function
 * @param { String } message The message
 * @param { * } data The data passed to the subscriber
 */
function callSubscriberWithImmediateExceptions(
  subscriber: TSubscriber,
  message: TMessage,
  data?: any,
): void {
  subscriber(message, data)
}

/**
 * Deliver a message to all subscribers for a specific message
 * @param { String } originalMessage The original message
 * @param { String } matchedMessage The matched message
 * @param { * } data The data passed to the subscriber
 * @param { Boolean } immediateExceptions Whether to allow exceptions to propagate
 */
function deliverMessage(
  originalMessage: TMessage,
  matchedMessage: TMessage,
  data?: any,
  immediateExceptions?: boolean,
): void {
  const subscribers = messages[matchedMessage as string]
  const callSubscriber = immediateExceptions
    ? callSubscriberWithImmediateExceptions
    : callSubscriberWithDelayedExceptions

  if (!Object.prototype.hasOwnProperty.call(messages, matchedMessage)) {
    return
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const s in subscribers) {
    if (Object.prototype.hasOwnProperty.call(subscribers, s)) {
      callSubscriber(subscribers[s], originalMessage, data)
    }
  }
}

/**
 * Create a function to deliver a message to all subscribers
 * @param { String } message The message
 * @param { * } data The data passed to the subscriber
 * @param { Boolean } immediateExceptions Whether to allow exceptions to propagate
 * @returns { Function }
 */
function createDeliveryFunction(
  message: TMessage,
  data?: any,
  immediateExceptions?: boolean,
): () => void {
  return function deliverNamespaced() {
    let topic = String(message)
    let position = topic.lastIndexOf('.')

    // deliver the message as it is now
    deliverMessage(message, message, data, immediateExceptions)

    // trim the hierarchy and deliver message to each level
    while (position !== -1) {
      topic = topic.substr(0, position)
      position = topic.lastIndexOf('.')
      deliverMessage(message, topic, data, immediateExceptions)
    }

    deliverMessage(message, ALL_SUBSCRIBING_MSG, data, immediateExceptions)
  }
}

/**
 * Check if there are direct subscribers for a specific message
 * @param { String } message The message
 * @returns { Boolean }
 */
function hasDirectSubscribersFor(message: TMessage): boolean {
  const topic = String(message)
  const found = Boolean(
    Object.prototype.hasOwnProperty.call(messages, topic) && hasKeys(messages[topic]),
  )

  return found
}

/**
 * Check if there are subscribers for a specific message or any of its ancestors
 * @param { String } message The message
 * @returns { Boolean }
 */
function messageHasSubscribers(message: TMessage): boolean {
  let topic = String(message)
  let found = hasDirectSubscribersFor(topic) || hasDirectSubscribersFor(ALL_SUBSCRIBING_MSG)
  let position = topic.lastIndexOf('.')

  while (!found && position !== -1) {
    topic = topic.substr(0, position)
    position = topic.lastIndexOf('.')
    found = hasDirectSubscribersFor(topic)
  }

  return found
}

/**
 * Publish a message to all subscribers
 * @param { String } message The message
 * @param { * } data The data passed to the subscriber
 * @param { Boolean } sync Whether to publish synchronously
 * @param { Boolean } immediateExceptions Whether to allow exceptions to propagate
 * @returns { Boolean }
 */
function publish(
  message: TMessage,
  data?: any,
  sync?: boolean,
  immediateExceptions?: boolean,
): boolean {
  message = typeof message === 'symbol' ? message.toString() : message

  const deliver = createDeliveryFunction(message, data, immediateExceptions)
  const hasSubscribers = messageHasSubscribers(message)

  if (!hasSubscribers) {
    return false
  }

  if (sync === true) {
    deliver()
  } else {
    setTimeout(deliver, 0)
  }
  return true
}

export default PubSub
