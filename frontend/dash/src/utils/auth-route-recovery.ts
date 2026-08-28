const AUTH_ROUTE_RECOVERY_PREFIX = 'groupher-auth:route-recovery:'
const ATTEMPTED = 'attempted'

/** Runs the auth route recovery key operation at the frontend shared boundary. */
export const authRouteRecoveryKey = (href: string): string => `${AUTH_ROUTE_RECOVERY_PREFIX}${href}`

/** Returns whether this URL has already crossed the reload recovery boundary. */
export const hasAuthRouteRecoveryAttempt = (href: string): boolean =>
  sessionStorage.getItem(authRouteRecoveryKey(href)) === ATTEMPTED

/** Marks the single reload recovery allowed for this URL. */
export const markAuthRouteRecoveryAttempt = (href: string): void => {
  sessionStorage.setItem(authRouteRecoveryKey(href), ATTEMPTED)
}

/** Clears the bounded recovery marker after the route loads successfully. */
export const clearAuthRouteRecoveryAttempt = (href: string): void => {
  sessionStorage.removeItem(authRouteRecoveryKey(href))
}
