import { type FC, memo } from 'react'

import VIEW from '~/const/view'
import TagsBar from '~/unit/TagsBar'
import Sticky from '~/widgets/Sticky'
import Tabs from '~/widgets/Switcher/Tabs'

import { TABS_MODE_OPTIONS } from '../constant'
import { tagsModeChange } from '../logic'
import type { TTagsMode } from '../spec'
import useSalon from './salon/sidebar'

type TProps = {
  tagsMode: TTagsMode
}

const Sidebar: FC<TProps> = ({ tagsMode }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.desc}>Groupher 的功能更新，界面调整，性能与 Bug 修复等</div>
      <Sticky offsetTop={30}>
        <div className={s.tabs}>
          <Tabs
            items={TABS_MODE_OPTIONS.slice(1)}
            size='small'
            activeKey={tagsMode}
            bottomSpace={4}
            onChange={tagsModeChange}
            view={VIEW.DESKTOP}
          />
        </div>
        <TagsBar onSelect={() => console.log} />
      </Sticky>
    </div>
  )
}

export default memo(Sidebar)
