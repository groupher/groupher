import type { Snapshot } from 'valtio'
import type { TInit as TArticlesInit, TStore as TArticlesStore } from './articles/spec'

export type TRootStore = {
  articles: TArticlesStore
}

export type TTreeStoreKey = keyof TRootStore
export type TTreeStore<K extends TTreeStoreKey> = TRootStore[K]

export type TRootStoreInit = {
  articles?: TArticlesInit
}

export type TRootStoreSnapshot = Snapshot<TRootStore>
