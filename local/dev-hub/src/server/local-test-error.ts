/** A safe, structured error returned by the managed fixture service. */
export class LocalFixtureError extends Error {
  readonly code: string
  readonly details: Record<string, unknown> | undefined

  constructor(code: string, details?: Record<string, unknown>) {
    const run =
      typeof details?.run === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(details.run)
        ? details.run
        : undefined
    const pending = [
      'local_test_article_recovery_required',
      'local_test_article_pending',
      'local_test_terminal_evidence_unavailable',
    ].includes(code)
    super(
      code === 'slug_retained' && typeof details?.slug === 'string'
        ? `Local fixture rejected: slug_retained (${details.slug}, ${String(details.lifecycle)}); choose a new slug.`
        : pending
          ? `Local fixture rejected: ${code}. The Article may still be in progress; inspect ${run ? `pnpm seed cleanup run --run ${run}` : 'the run cleanup preview'} before taking further action.`
          : code === 'local_test_article_client_outdated'
            ? 'Local fixture rejected: local_test_article_client_outdated. Update the checkout and restart the managed Hub and Phoenix.'
            : `Local fixture rejected: ${code}`,
    )
    this.name = 'LocalFixtureError'
    this.code = code
    this.details = details
  }
}

/** Preserve early errors and identify potentially submitted Article failures. */
export function articleDispatchError(error: unknown, run: unknown, dispatchAttempted: boolean) {
  if (!dispatchAttempted) return error
  return new LocalFixtureError('local_test_article_recovery_required', {
    run,
    cause: error instanceof LocalFixtureError ? error.code : 'transport_or_publisher_error',
  })
}
