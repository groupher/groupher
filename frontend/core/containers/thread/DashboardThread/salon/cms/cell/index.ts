import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill, cut, avatar, rainbow } = useTwBelt()

  return {
    communityTitle: cn('text-sm bold-sm', fg('title')),
    //
    actionCell: 'column align-center group',
    switchButton: 'mt-0.5 px-1.5 py-0.5 group-smoky-0 trans-all-100',
    //
    articleTitle: cn('text-sm pointer', cut('w-64'), fg('title')),
    stateWrapper: 'align-both',
    communitySlug: cn('text-sm no-underline -mt-0.5', fg('link'), 'hover:underline'),
    communityLogo: 'size-6 mr-2.5 -mt-1',
    //
    dateCell: 'column items-end gap-y-0.5 mt-px',
    //
    author: 'column items-end gap-y-0.5',
    authorAvatar: cn('size-4 mt-px', avatar()),
    nickname: cn('text-xs', cut('w-20')),
    //
    pending: cn('bold-sm text-xs mt-0.5', fg('digest')),
    pendingBlocked: rainbow(COLOR_NAME.RED, 'fg'),
    //
    dateItem: cn('row-center text-xs', fg('digest')),
    dateItemWarn: rainbow(COLOR_NAME.RED, 'fg'),
    //
    pulseIcon: cn('size-2.5 opacity-80 mr-1.5', fill('digest')),
  }
}
