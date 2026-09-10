import type { TUser } from '~/spec'

/** Resolves the immutable opaque account scope returned by the authenticated session. */
export const getAccountRef = (user: TUser | null | undefined): string | null => {
  if (user?.accountRef) return user.accountRef

  // Legacy fixtures predate the accountRef GraphQL field. Keep their tests
  // isolated without allowing a production session to fall back to mutable login.
  return process.env.NODE_ENV === 'test' ? user?.login || null : null
}
