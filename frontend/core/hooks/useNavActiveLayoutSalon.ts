import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'
import type { TNavActiveLayout } from '~/spec'

type TProps = {
  layout?: TNavActiveLayout | null
}

export default function useNavActiveLayoutSalon({ layout }: TProps = {}) {
  const { cn, bg, primary } = useTwBelt()
  const { navActiveLayout } = useLayout()

  const resolvedLayout = layout ?? navActiveLayout

  // Centralize the active-state tone mapping for nav/thread items so dashboard
  // preview cards and real community navigation resolve the same layout enum to
  // the same color treatment.
  //
  // This hook intentionally stays at the "active look" layer only. Business
  // components still own their local spacing, opacity, radius, and most of
  // their typography. `bold-sm` is kept here because active nav items should
  // share the same emphasis baseline across these supported surfaces.
  const ACTIVE_LAYOUTS = {
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
  }

  return ACTIVE_LAYOUTS[resolvedLayout] ?? ACTIVE_LAYOUTS[NAV_ACTIVE_LAYOUT.TEXT]
}
