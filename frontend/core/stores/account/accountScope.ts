import type { TAuthenticatedUser } from '~/spec'

/** Namespaces account-local browser state using the immutable Groupher login. */
export const getAccountScope = (
  user: Pick<TAuthenticatedUser, 'login'> | null | undefined,
): string | null => (user ? `user:${encodeURIComponent(user.login)}` : null)
