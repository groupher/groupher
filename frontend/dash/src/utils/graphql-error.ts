const ERROR_CODE_PREFIX = '[groupher-error-code:'

const isMachineCode = (value: string): boolean => /^[A-Z][A-Z0-9_]*$/.test(value)

/** Serializes graph qlerror for the frontend shared protocol boundary. */
export const serializeGraphQLError = (message: string, code?: string): string =>
  code && isMachineCode(code) ? `${ERROR_CODE_PREFIX}${code}] ${message}` : message

/** Reads graph qlerror code through the bounded frontend shared interface. */
export const readGraphQLErrorCode = (error: Error & { code?: unknown }): string | undefined => {
  if (typeof error.code === 'string' && isMachineCode(error.code)) return error.code
  if (!error.message.startsWith(ERROR_CODE_PREFIX)) return undefined

  const end = error.message.indexOf(']', ERROR_CODE_PREFIX.length)
  if (end === -1) return undefined

  const code = error.message.slice(ERROR_CODE_PREFIX.length, end)
  return isMachineCode(code) ? code : undefined
}

/** Reads graph qlerror message through the bounded frontend shared interface. */
export const readGraphQLErrorMessage = (message: string): string => {
  if (!message.startsWith(ERROR_CODE_PREFIX)) return message

  const end = message.indexOf(']', ERROR_CODE_PREFIX.length)
  if (end === -1) return message

  const code = message.slice(ERROR_CODE_PREFIX.length, end)
  return isMachineCode(code) ? message.slice(end + 1).trimStart() : message
}
