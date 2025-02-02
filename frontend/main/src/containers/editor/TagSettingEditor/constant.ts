import { COLOR_NAME } from '~/const/colors'
import { THREAD } from '~/const/thread'

export const DEFAULT_CREATE_TAG = {
  id: '',
  color: COLOR_NAME.BLACK,
  // index?: number
  slug: '',
  title: '',
  desc: '',
  thread: THREAD.POST.toUpperCase(),
  group: '',
}

export const holder = 1
