import type { TArtifactRef } from './artifactRef'

export const THREAD_DATASET_SCHEMA_VERSION = 1 as const

export type TThreadDatasetHeader = {
  capabilities: {
    actors: boolean
    assets: boolean
    comments: boolean
    reactions: boolean
    replies: boolean
  }
  datasetRef: string
  schemaVersion: typeof THREAD_DATASET_SCHEMA_VERSION
  source: {
    kind: 'repo'
    platform: 'github'
    revision: string
    scopeRef: string
  }
  thread: 'doc'
}

export type TThreadDatasetRefs = {
  analysisRef: TArtifactRef
  badSmellsRef: TArtifactRef
  bodiesRef: TArtifactRef
  treeRef: TArtifactRef
}
