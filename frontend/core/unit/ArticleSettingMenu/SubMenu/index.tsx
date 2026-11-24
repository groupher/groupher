import { lazy, Suspense, type ComponentType, type FC } from 'react'

import { SUB_MENU } from '../constant'
import type { TSubMenu } from '../spec'
import CatSetting from './CatSetting'
import Header from './Header'
import HistorySetting from './HistorySetting'
import useSalon from './salon'
import SlugSetting from './SlugSetting'
import TagsSetting from './TagsSetting'
import TitleSetting from './TitleSetting'

const BodySetting = lazy(() => import('./BodySetting'))

type TProps = {
  closeSubMenu: () => void
  subMenuType: TSubMenu
}

type TContentProps = {
  onBack: () => void
}

const SubMenu: FC<TProps> = ({ closeSubMenu, subMenuType }) => {
  const s = useSalon()

  let Content: ComponentType<TContentProps> | null = null

  switch (subMenuType) {
    case SUB_MENU.EDIT: {
      Content = TitleSetting
      break
    }

    case SUB_MENU.BODY: {
      Content = BodySetting
      break
    }

    case SUB_MENU.CATEGORY: {
      Content = CatSetting
      break
    }

    case SUB_MENU.SLUG: {
      Content = SlugSetting
      break
    }

    case SUB_MENU.TAGS: {
      Content = TagsSetting
      break
    }

    case SUB_MENU.HISTORY: {
      Content = HistorySetting
      break
    }

    default: {
      Content = null
      break
    }
  }

  if (!Content) return null

  return (
    <div className={s.wrapper}>
      <Header type={subMenuType} />
      <Suspense fallback={<div className='px-2 py-3 text-sm'>正在加载正文编辑器…</div>}>
        <Content onBack={closeSubMenu} />
      </Suspense>
    </div>
  )
}

export default SubMenu
