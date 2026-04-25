import type { TThread } from '~/spec'

export const getTargetPage = (community: string, _thread: TThread): string => {
  return `/publish/${_thread}?community=${community}`
}

export const getText = (_thread: TThread): string => {
  return '发布帖子'
}
