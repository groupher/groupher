import type { TDocPublicTreeItem } from '~/spec'

export type TTreeTocItem = TDocPublicTreeItem & {
  groupId: string
  groupTitle: string
}

export type TTreeTocSelectHandler = (item: TTreeTocItem) => void
