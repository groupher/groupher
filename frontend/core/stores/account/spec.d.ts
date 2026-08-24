import type { TUser } from '~/spec'

/** Server session seed consumed by TanStack Query; it is not Valtio store state. */
export type TInit = {
  user?: TUser | null
  loading?: boolean
}
