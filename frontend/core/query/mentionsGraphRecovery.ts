import { GraphQLRequestError } from '~/graphql/client'

/** Identifies graph revision and cursor rejection without retrying unrelated errors. */
export function isMentionsGraphRestartError(error: unknown): boolean {
  return (
    error instanceof GraphQLRequestError &&
    error.errors.length > 0 &&
    error.errors.every(({ extensions }) => ['4551', '4553'].includes(String(extensions?.code)))
  )
}

/** Repeats a cursor-free read once after a revision race. */
export async function readMentionsGraphWithRestart<T>(
  read: () => Promise<T>,
  hasCursor: boolean,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (
      hasCursor ||
      signal?.aborted ||
      !isMentionsGraphRestartError(error) ||
      (error as GraphQLRequestError).errors.some(
        ({ extensions }) => String(extensions?.code) !== '4553',
      )
    ) {
      throw error
    }
    return read()
  }
}
