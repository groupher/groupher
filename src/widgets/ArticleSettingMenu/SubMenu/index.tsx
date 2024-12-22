import type { FC } from 'react'

import type { TSubMenu } from '../spec'
import { SUB_MENU_TYPE } from '../constant'

import Header from './Header'

import TitleSetting from './TitleSetting'
import CatSetting from './CatSetting'
import StateSetting from './StateSetting'
import SlugSetting from './SlugSetting'
import TagsSetting from './TagsSetting'
import Mirror2Home from './Mirror2Home'

import useSalon from '../styles/sub_menu'

type TProps = {
  closeSubMenu: () => void
  subMenuType: TSubMenu
}

const SubMenu: FC<TProps> = ({ closeSubMenu, subMenuType }) => {
  const s = useSalon()

  let Content = null

  switch (subMenuType) {
    case SUB_MENU_TYPE.EDIT: {
      Content = TitleSetting
      break
    }

    case SUB_MENU_TYPE.CATEGORY: {
      Content = CatSetting
      break
    }

    case SUB_MENU_TYPE.STATE: {
      Content = StateSetting
      break
    }

    case SUB_MENU_TYPE.SLUG: {
      Content = SlugSetting
      break
    }

    case SUB_MENU_TYPE.MIRROR: {
      Content = Mirror2Home
      break
    }

    case SUB_MENU_TYPE.TAGS: {
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
