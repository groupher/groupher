import { pick } from 'ramda'
import useDashboard from '~/stores/dashboard/hooks'
import type { TEditFunc, TInlineTagLayout, TTag, TTagLayout, TThread } from '~/spec'
import type { TChangeTagMode } from '~/stores/dashboard/spec'

import useHelper from '../useHelper'
import useDerived, { type TRet as TDrived } from './useDerived'
import useUtils from './useUtils'

type TRet = {
  loading: boolean
  saving: boolean
  editingTag: TTag
  settingTag: TTag
  activeTagGroup: string
  activeTagThread: string
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout

  edit: TEditFunc
  changeThread: (thread: string) => void
  editTag: (key: TChangeTagMode, tag: TTag) => void

  loadTags: (thread?: TThread) => void
  moveTagUp: (tag: TTag) => void
  moveTagDown: (tag: TTag) => void
  moveTag2Top: (tag: TTag) => void
  moveTag2Bottom: (tag: TTag) => void
} & TDrived

export default function useTags(): TRet {
  const dsb$ = useDashboard()
  const { edit } = useHelper()
  const derived = useDerived()

  const { loadTags, moveTag, moveTag2Edge } = useUtils()

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
  const changeThread = (thread: string) => dsb$.commit({ activeTagThread: thread })

  const moveTagUp = (tag: TTag): void => moveTag(tag, 'up')
  const moveTagDown = (tag: TTag): void => moveTag(tag, 'down')
  const moveTag2Top = (tag: TTag): void => moveTag2Edge(tag, 'top')
  const moveTag2Bottom = (tag: TTag): void => moveTag2Edge(tag, 'bottom')

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
    moveTagUp,
    moveTagDown,
    moveTag2Top,
    moveTag2Bottom,
  }
}
