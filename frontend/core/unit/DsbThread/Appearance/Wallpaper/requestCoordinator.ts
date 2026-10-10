export type TPendingWallpaperSave = {
  fingerprint: string
  commandId: string
}

type TResolveWallpaperCommandIdInput = {
  fingerprint: string
  pending: TPendingWallpaperSave | null
  createKey?: () => string
}

const createCommand = (): string => createCommandHandle({ scope: 'wallpaper' }).commandId

/** Reuses a command id only when the pending request represents the same fingerprint. */
export const resolveWallpaperCommandId = ({
  fingerprint,
  pending,
  createKey = createCommand,
}: TResolveWallpaperCommandIdInput): TPendingWallpaperSave => ({
  fingerprint,
  commandId: pending?.fingerprint === fingerprint ? pending.commandId : createKey(),
})
import { createCommandHandle } from '~/query/mutation/optimistic/execute'
