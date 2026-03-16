import { AVATAR_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { avatarLayout } = useLayout()
  const { cn, avatar, fill, margin, primary, shadow } = useTwBelt()

  return {
    wrapper: cn('size-12 shrink-0', margin(spacing)),
    innerWrapper: cn(
      'align-both relative p-0.5 border',
      primary('borderSoft'),
      avatarLayout === AVATAR_LAYOUT.SQUARE ? 'rounded-md' : 'circle',
    ),
    avatar: cn('size-10', avatar()),
    badge: cn(
      'align-both absolute  size-3.5 circle border z-30',
      primary('bg'),
      avatarLayout === AVATAR_LAYOUT.SQUARE ? '-bottom-1 -right-1' : 'bottom-0 -right-0.5',
      shadow('md'),
    ),
    starIcon: cn('size-2.5 opacity-80', fill('button.fg')),
  }
}
