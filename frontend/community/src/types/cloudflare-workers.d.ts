declare module 'cloudflare:workers' {
  /** Extends the current Worker request lifetime until the promise settles. */
  export function waitUntil(promise: Promise<unknown>): void
}
