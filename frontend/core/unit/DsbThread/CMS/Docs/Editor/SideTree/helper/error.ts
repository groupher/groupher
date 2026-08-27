/**
 * Convert GraphQL or runtime mutation errors into a readable toast message.
 *
 * @example
 * const message = formatMutationError(error)
 * toast(message, 'error')
 */
export const formatMutationError = (err: unknown): string => {
  const graphQLErrors = (err as { graphQLErrors?: Array<{ message?: unknown }> })?.graphQLErrors

  if (Array.isArray(graphQLErrors) && graphQLErrors.length > 0) {
    return graphQLErrors
      .map((error) => {
        const { message } = error

        if (Array.isArray(message)) {
          return message
            .map((item) => {
              if (typeof item === 'string') return item
              if (item && typeof item === 'object' && 'message' in item) {
                const key = 'key' in item ? `${item.key}: ` : ''
                return `${key}${item.message}`
              }
              return JSON.stringify(item)
            })
            .join('; ')
        }

        if (typeof message === 'string') return message
        return JSON.stringify(message)
      })
      .join('; ')
  }

  return err instanceof Error ? err.message : String(err)
}
