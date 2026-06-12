import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'
import type { TNavActiveLayout } from '~/spec'

type TActiveLayoutStyle = {
  item: string
  text: string
  icon: string
}

type TProps = {
  layout?: TNavActiveLayout | null
}

type TNavActiveStyleHelpers = {
  cn: (className: string, ...rest: Array<string | false | null | undefined>) => string
  bg: (key: string) => string
  primary: (key: string) => string
}

export const getNavActiveLayoutStyles = ({
  cn,
  bg,
  primary,
}: TNavActiveStyleHelpers): Record<TNavActiveLayout, TActiveLayoutStyle> => ({
  [NAV_ACTIVE_LAYOUT.TEXT]: {
    item: cn(primary('fg'), 'bold-sm'),
    text: cn(primary('fg'), 'bold-sm'),
    icon: primary('fill'),
  },
  [NAV_ACTIVE_LAYOUT.GRAY_BG]: {
    item: cn(primary('fg'), bg('hoverBg'), 'bold-sm'),
    text: cn(primary('fg'), 'bold-sm'),
    icon: primary('fill'),
  },
  [NAV_ACTIVE_LAYOUT.SOFT_BG]: {
    item: cn(primary('fg'), primary('bgSoft'), 'bold-sm'),
    text: cn(primary('fg'), 'bold-sm'),
    icon: primary('fill'),
  },
})

export const getActiveNavLayoutStyles = (
  { cn, bg, primary }: TNavActiveStyleHelpers,
  layout: TNavActiveLayout | null | undefined,
) => {
  const activeStyles = getNavActiveLayoutStyles({ cn, bg, primary })
  const resolvedLayout = layout ?? NAV_ACTIVE_LAYOUT.TEXT

  return activeStyles[resolvedLayout] ?? activeStyles[NAV_ACTIVE_LAYOUT.TEXT]
}

export default function useNavActiveLayoutSalon({ layout }: TProps = {}) {
  const { cn, bg, primary } = useTwBelt()
  const { navActiveLayout } = useLayout()

  const resolvedLayout = layout ?? navActiveLayout

  return getActiveNavLayoutStyles({ cn, bg, primary }, resolvedLayout)
}
