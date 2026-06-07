import type { FC } from 'react'

import { TAGS_MODE } from '../../constant'
import type { TTagsMode } from '../../spec'
import useSalon from './salon'
import TagFilter from './TagFilter'
import TimeFilter from './TimeFilter'
import VersionFilter from './VersionFilter'

type TProps = {
  tab: TTagsMode
}

const FilterBar: FC<TProps> = ({ tab }) => {
  const s = useSalon()

  switch (tab) {
    case TAGS_MODE.TAG: {
      return (
        <div className={s.wrapper}>
          <TagFilter />
          <div className={s.divider} />
        </div>
      )
    }

    case TAGS_MODE.TIME: {
      return (
        <div className={s.wrapper}>
          <TimeFilter />
          <div className={s.divider} />
        </div>
      )
    }

    case TAGS_MODE.VERSION: {
      return (
        <div className={s.wrapper}>
          <VersionFilter />
          <div className={s.divider} />
        </div>
      )
    }

    default: {
      return null
    }
  }
}

export default FilterBar
