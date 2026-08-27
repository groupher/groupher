import useTwBelt from '~/hooks/useTwBelt'

import styles from './footer.module.css'

export default function useSalon() {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: 'w-full mt-20 pb-10',
    heading: 'row-center w-full gap-5',
    title: cn('shrink-0 text-sm', fg('digest')),
    topDivider: cn('h-px flex-1 border-b opacity-55', br('divider')),
    content: 'row-center row-between w-full gap-8 py-4',
    actions: 'row-center gap-4.5 shrink-0 mb-0.5',
    feedbackTagsMotion: 'w-full overflow-hidden',
    bottomDivider: cn(styles.receiptDivider, br('divider')),
  }
}
