import type { FC } from 'react'

import { SUB_MENU } from '../constant'
import useSalon from '../salon/sub_menu'
import type { TSubMenu } from '../spec'
import CatSetting from './CatSetting'
import Header from './Header'
import Mirror2Home from './Mirror2Home'
import SlugSetting from './SlugSetting'
import StatusSetting from './StatusSetting'
import TagsSetting from './TagsSetting'
import TitleSetting from './TitleSetting'

type TProps = {
  closeSubMenu: () => void
  subMenuType: TSubMenu
}

const SubMenu: FC<TProps> = ({ closeSubMenu, subMenuType }) => {
  const s = useSalon()

  let Content = null

  switch (subMenuType) {
    case SUB_MENU.EDIT: {
      Content = TitleSetting
      break
    }

    case SUB_MENU.CATEGORY: {
      Content = CatSetting
      break
    }

    case SUB_MENU.STATUS: {
      Content = StatusSetting
      break
    }

    case SUB_MENU.SLUG: {
      Content = SlugSetting
      break
    }

    case SUB_MENU.MIRROR: {
      Content = Mirror2Home
      break
    }

    case SUB_MENU.TAGS: {
      Content = TagsSetting
      break
    }

    default: {
      Content = <div>??</div>
      break
    }
  }

  return (
    <div className={s.wrapper}>
      <Header type={subMenuType} />
      <Content onBack={closeSubMenu} />
    </div>
  )
}

export default SubMenu
