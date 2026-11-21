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
import type { TChangeTagMode } from '~/spec'
import { useTagsEditor } from '~/stores/dsbShell/editor'
import useDsbShell from '~/stores/dsbShell/hooks'

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

/** Exposes tags state and actions through the shared React hook boundary. */
export default function useTags(): TRet {
  const dsb$ = useDsbShell()
  const tagsEditor = useTagsEditor()
  const { edit } = useHelper()
  const derived = useDerived()

  const {
    loadTags,
    loading,
    createGroup,
    createTag,
    updateTag,
    commitTagSorting,
    renameGroup,
    saving,
  } = useUtils()

  const exportState = ['tagLayout', 'inlineTagLayout', 'activeTagGroup', 'activeTagThread']

  const editTag = (key: TChangeTagMode, tag: TTag): void => tagsEditor.setTag(key, tag)
  const changeThread = (thread: TThread): void => {
    dsb$.editMany({
      activeTagThread: thread,
      activeTagGroup: null,
    })
    tagsEditor.setEditingTag(null)
    tagsEditor.setSettingTag(null)
    loadTags(thread)
  }

  return {
    // @ts-expect-error
    ...pick(exportState, dsb$),
    editingTag: tagsEditor.editingTag,
    settingTag: tagsEditor.settingTag,
    loading,
    ...derived,
    saving,
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
