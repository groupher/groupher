const AUTH_ROUTE_RECOVERY_PREFIX = 'groupher-auth:route-recovery:'

export const authRouteRecoveryKey = (href: string): string => `${AUTH_ROUTE_RECOVERY_PREFIX}${href}`
