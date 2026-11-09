import type { ComponentType, FC } from 'react'

import { SUB_MENU } from '../constant'
import type { TSubMenu } from '../spec'
import CatSetting from './CatSetting'
import Header from './Header'
import useSalon from './salon'
import SlugSetting from './SlugSetting'
import TagsSetting from './TagsSetting'
import TitleSetting from './TitleSetting'

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

    default: {
      Content = null
      break
    }
  }

  if (!Content) return null

  return (
    <div className={s.wrapper}>
      <Header type={subMenuType} />
      <Content onBack={closeSubMenu} />
    </div>
  )
}

export default SubMenu
