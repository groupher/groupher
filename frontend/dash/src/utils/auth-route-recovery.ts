const AUTH_ROUTE_RECOVERY_PREFIX = 'groupher-auth:route-recovery:'

/** Runs the auth route recovery key operation at the frontend shared boundary. */
export const authRouteRecoveryKey = (href: string): string => `${AUTH_ROUTE_RECOVERY_PREFIX}${href}`
