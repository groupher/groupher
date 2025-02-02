import type { TThread } from '~/spec'

export const getTargetPage = (community: string, thread: TThread): string => {
  return `/publish/${thread}?community=${community}`
}

export const getText = (thread: TThread): string => {
  return '发布帖子'
}
