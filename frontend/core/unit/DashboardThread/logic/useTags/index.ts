import { pick } from 'ramda'

import type {
  TColorName,
  TEditFunc,
  TInlineTagLayout,
  TTag,
  TTagGroup,
  TTagLayout,
  TThread,
} from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import type { TChangeTagMode } from '~/stores/dashboard/spec'

import useHelper from '../useHelper'
import useDerived, { type TRet as TDrived } from './useDerived'
import useUtils from './useUtils'

type TRet = {
  loading: boolean
  saving: boolean
  editingTag: TTag | null
  settingTag: TTag | null
  activeTagGroup: string | null
  activeTagThread: TThread | null
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout

  edit: TEditFunc
  changeThread: (thread: TThread) => void
  editTag: (key: TChangeTagMode, tag: TTag) => void

  loadTags: (thread?: TThread) => void
  createGroup: (title: string) => Promise<void>
  createTag: (title: string, groupId: string, color?: TColorName) => Promise<void>
  updateTag: (tag: TTag) => Promise<void>
  renameGroup: (groupId: string, toGroup: string) => Promise<void>
  commitTagSorting: (tagGroups: TTagGroup[]) => void
} & TDrived

export default function useTags(): TRet {
  const dsb$ = useDashboard()
  const { edit } = useHelper()
  const derived = useDerived()

  const { loadTags, createGroup, createTag, updateTag, commitTagSorting, renameGroup } = useUtils()

  const exportState = [
    'loading',
    'tagLayout',
    'inlineTagLayout',
    'editingTag',
    'activeTagGroup',
    'activeTagThread',
    'settingTag',
    'loading',
    'saving',
  ]

  const editTag = (key: TChangeTagMode, tag: TTag): void => dsb$.commit({ [key]: tag })
  const changeThread = (thread: TThread): void => {
    dsb$.commit({
      activeTagThread: thread,
      activeTagGroup: null,
      editingTag: null,
      settingTag: null,
    })
    loadTags(thread)
  }

  return {
    // @ts-expect-error
    ...pick(exportState, dsb$),
    ...derived,
    // actions
    changeThread,
    editTag,
    edit,
    // move actions
    loadTags,
    createGroup,
    createTag,
    updateTag,
    renameGroup,
    commitTagSorting,
  }
}
