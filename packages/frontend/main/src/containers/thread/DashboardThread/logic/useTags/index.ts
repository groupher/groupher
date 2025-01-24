import { pick } from 'ramda'

import type { TTag, TThread, TEditFunc, TTagLayout } from '~/spec'
import type { TChangeTagMode } from '~/stores/dashboard/spec'
import useSubState from '~/hooks/useSubStore'

import useHelper from '../useHelper'

import useUtils from './useUtils'
import useDrived, { type TRet as TDrived } from './useDrived'

type TRet = {
  loading: boolean
  saving: boolean
  editingTag: TTag
  settingTag: TTag
  activeTagGroup: string
  activeTagThread: string
  tagLayout: TTagLayout

  edit: TEditFunc
  changeThread: (thread: string) => void
  editTag: (key: TChangeTagMode, tag: TTag) => void

  loadTags: (thread?: TThread) => void
  moveTagUp: (tag: TTag) => void
  moveTagDown: (tag: TTag) => void
  moveTag2Top: (tag: TTag) => void
  moveTag2Bottom: (tag: TTag) => void
} & TDrived

export default (): TRet => {
  const store = useSubState('dashboard')
  const { edit } = useHelper()
  const drived = useDrived()
  const { loadTags, moveTag, moveTag2Edge } = useUtils()

  const exportState = [
    'loading',
    'tagLayout',
    'editingTag',
    'activeTagGroup',
    'activeTagThread',
    'settingTag',
    'loading',
    'saving',
  ]

  const editTag = (key: TChangeTagMode, tag: TTag): void => store.commit({ [key]: tag })
  const changeThread = (thread: string) => store.commit({ activeTagThread: thread })

  const moveTagUp = (tag: TTag): void => moveTag(tag, 'up')
  const moveTagDown = (tag: TTag): void => moveTag(tag, 'down')
  const moveTag2Top = (tag: TTag): void => moveTag2Edge(tag, 'top')
  const moveTag2Bottom = (tag: TTag): void => moveTag2Edge(tag, 'bottom')

  return {
    ...pick(exportState, store),
    ...drived,
    // actions
    changeThread,
    editTag,
    edit,
    // move actions
    loadTags,
    moveTagUp,
    moveTagDown,
    moveTag2Top,
    moveTag2Bottom,
  }
}
