import type { TImportProcess } from '../../ContentImport/ProcessLog/spec'
import type { PHASE } from './constant'

export type TImportPhase = (typeof PHASE)[keyof typeof PHASE]

export type TImportTreeChild = {
  sourceId: string
  sourcePath?: string
  title: string
  type: 'link' | 'page'
}

export type TImportTreeGroup = {
  children: TImportTreeChild[]
  sourceId: string
  title: string
}

export type TImportTreeTab = {
  groups: TImportTreeGroup[]
  sourceId: string
  title: string
}

export type TImportSourceNode = {
  children?: TImportSourceNode[]
  draft?: boolean
  kind: 'link' | 'page' | 'scope' | 'section'
  navigationStatus?: 'unlisted'
  sizeBytes?: number
  sourceId: string
}

export type TDocImportSourceInfo = {
  branch: string
  commit: string
  configPaths: string[]
  contentRoot: string
  framework: string
  repo: string
  repoUrl: string
}

export type TDocImportCounts = {
  assets: number
  groups: number
  links: number
  pages: number
  tabs: number
}

export type TDocImportBadSmell = {
  code: string
  level: 'error' | 'warning'
  message: string
  path?: string
  sourceRef?: string
}

export type TContentImportIssue = {
  code: string
  externalRef: string
  message: string
  stage: 'source' | 'conversion' | 'validation'
}

export type TDocImportPreview = {
  conflicts: Array<Record<string, unknown>>
  counts: TDocImportCounts
  badSmells: TDocImportBadSmell[]
  expiresAt: string
  previewRef: string
  sourceInfo: TDocImportSourceInfo
  targetRevision: string
  targetTree: { tabs: TImportTreeTab[] }
  tree: { navigation: TImportSourceNode[] }
}

export type TContentImportJob = {
  id: string
  status: 'ready' | 'applying' | 'completed' | 'failed' | string
  progress: {
    bodies?: { failed?: number; pending?: number; ready?: number; skipped?: number; total?: number }
  }
  process: TImportProcess
  errorCode?: string | null
  errorMessage?: string | null
  sourceInfo: {
    branch: string
    commit?: string | null
    configPaths: string[]
    contentRoot?: string | null
    framework?: string | null
    repo: string
    repoUrl: string
  }
  counts: { assets: number; groups: number; links: number; pages: number; tabs: number }
  tree: { tabs: TImportTreeTab[] }
  badSmells: Array<{ code?: string; level?: string; message?: string }>
  targetBranch: string
  firstImportedDocRef?: string | null
  failedItems: TContentImportIssue[]
  skipped: TContentImportIssue[]
}

export type { TImportProcess } from '../../ContentImport/ProcessLog/spec'

export type TImportApplyResult = {
  jobRef: string
  status: string
}
