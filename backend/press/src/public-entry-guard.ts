/**
 * Chooses the response policy for the named public Worker entrypoint.
 *
 * Business position:
 *
 *   Service Binding request
 *     -> reject private paths
 *     -> enforce public-output switch
 */

export type PublicEntryDecision = 'not-found' | 'disabled' | 'allow'

/** Keeps private routes absent before applying the public-output switch. */
export const publicEntryDecision = (
  pathname: string,
  disabled: string | undefined,
): PublicEntryDecision => {
  if (pathname === '/health' || pathname === '/internal/invalidate') return 'not-found'
  return disabled === 'false' ? 'allow' : 'disabled'
}
