import type { ReactNode } from 'react'

import type {
  TChangeMode,
  TColorName,
  TConstValues,
  TDsbPath,
  TLinkDraftItem,
  TTransKey,
} from '~/spec'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

import type { FIELD } from './constant'

export { TNameAlias } from '~/spec'

type TMenuGroupName = 'BASIC' | 'ANALYSIS' | 'CMS' | 'INTEGRATE'

export type TDsbMenuGroup = {
  title: TTransKey
  icon: ReactNode
  initFold: boolean
  children: TDsbMenuItem[]
}

type TDsbMenuItem = { title: TTransKey; slug: TDsbPath; alias?: string }

export type TDsbMenu = {
  [k: TMenuGroupName]: TDsbMenuGroup
}

export type TLinkState = {
  editingLink: TLinkDraftItem | null
  saving: boolean
  editingLinkMode: TChangeMode
  editingGroup: string | null
  editingGroupIndex: number | null
}

export type TDsbStoreFieldKey = keyof TDsbFieldMap
export type TDsbFieldKey = TDsbStoreFieldKey | TConstValues<typeof FIELD>

type TDocFile = {
  index: number
  name: string
  articleId: string
  linkAddr: string
}

type TDocCategory = {
  name: string
  index: number
  color: TColorName
  files: TDocFile[]
}

export type TDocSettings = {
  categories: TDocCategory[]
}

export type THeaderEditType = 'logo' | 'title'
export type TFooterEditType = THeaderEditType | 'social'

export type TMoveLinkDir = 'up' | 'down' | 'top' | 'bottom'
