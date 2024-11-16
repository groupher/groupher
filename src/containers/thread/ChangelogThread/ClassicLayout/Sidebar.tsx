import { type FC, memo, useEffect } from 'react'

import VIEW from '~/const/view'

import TagsBar from '~/containers/unit/TagsBar'
import Tabs from '~/widgets/Switcher/Tabs'
import Sticky from '~/widgets/Sticky'

import type { TTagsMode } from '../spec'
import { TABS_MODE_OPTIONS } from '../constant'
import { tagsModeChange } from '../logic'
import useSalon from '../styles/classic_layout/sidebar'

type TProps = {
  tagsMode: TTagsMode
}

const Sidebar: FC<TProps> = ({ tagsMode }) => {
  const s = useSalon()

  useEffect(() => {
    setTimeout(() => {
      tagsModeChange(TABS_MODE_OPTIONS[1].slug)
    }, 100)
  }, [])

  return (
    <div className={s.wrapper}>
      <div className={s.desc}>Groupher 的功能更新，界面调整，性能与 Bug 修复等</div>
      <Sticky offsetTop={30}>
        <div className={s.tabs}>
          <Tabs
            items={TABS_MODE_OPTIONS.slice(1)}
            size="small"
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
