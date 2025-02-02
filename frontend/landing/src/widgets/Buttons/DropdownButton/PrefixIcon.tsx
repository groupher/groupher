import type { TButtonPrefix } from '~/spec'
import BUTTON_PREFIX from '~/const/button_prefix'

import CategorySVG from '~/icons/Category'
import SortSVG from '~/icons/Sort'
import WipSVG from '~/icons/GtdWip'

import useSalon from '../salon/dropdown_button/prefix_icon'

type TProps = {
  type: TButtonPrefix | null
}

export default ({ type }: TProps) => {
  const s = useSalon()

  switch (type) {
    case BUTTON_PREFIX.CATETORY: {
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
