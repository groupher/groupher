import type { TGitDiffScope } from '@shared/contracts'

export type THubViewMode = 'list' | 'flow'

export type THubDrawer =
  | { kind: 'git'; scope: TGitDiffScope }
  | { kind: 'metrics'; serviceId: string }
  | { kind: 'config'; serviceId: string }
  | null
