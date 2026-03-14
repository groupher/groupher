import BUTTON_PREFIX from '~/const/button_prefix'
import CategorySVG from '~/icons/Category'
import WipSVG from '~/icons/GtdWip'
import SortSVG from '~/icons/Sort'
import type { TButtonPrefix } from '~/spec'

import useSalon from '../salon/dropdown_button/prefix_icon'

type TProps = {
  type: TButtonPrefix | null
}

export default function PrefixIcon({ type }: TProps) {
  const s = useSalon()

  switch (type) {
    case BUTTON_PREFIX.CATEGORY: {
      return <CategorySVG className={s.icon} />
    }

    case BUTTON_PREFIX.SORT: {
      return <SortSVG className={s.icon} />
    }

    case BUTTON_PREFIX.STATUS: {
      return <WipSVG className={s.icon} />
    }

    default: {
      return null
    }
  }
}
