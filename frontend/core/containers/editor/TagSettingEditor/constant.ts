import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import { toGqlThread } from '~/utils/thread'

export const DEFAULT_CREATE_TAG = {
  id: '',
  color: COLOR.BLACK,
  // index?: number
  slug: '',
  title: '',
  desc: '',
  thread: toGqlThread(THREAD.POST, 'TAGS') || THREAD.POST.toUpperCase(),
  group: '',
}

export const holder = 1
