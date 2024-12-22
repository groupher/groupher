import { type FC, memo, useState, useRef } from 'react'

import useOutsideClick from '~/hooks/useOutsideClick'

import EditSVG from '~/icons/EditPen'
import SlugSVG from '~/icons/Slug'
import MergeSVG from '~/icons/Merge'
import ArchivedSVG from '~/icons/Archived'
import DeleteSVG from '~/icons/Trash'
import LockSVG from '~/icons/LockLight'
import ArrowSVG from '~/icons/ArrowSimple'
import ArticleMirror from '~/icons/MirrorShoe'

import type { TSubMenu } from '../spec'
import { SUB_MENU_TYPE } from '../constant'

import SubMenu from '../SubMenu'

import CatItem from './CatItem'
import TagsItem from './TagsItem'
import PinItem from './PinItem'
import StateItem from './StateItem'

import useSalon, { cn } from '../styles/menu'

type TProps = {
  onSubMenuToggle: (t: boolean) => void
  onClose: () => void
}

const Menu: FC<TProps> = ({ onSubMenuToggle, onClose }) => {
  const [subMenuType, setSubMenuType] = useState<TSubMenu>(null)
  const [subMenuActive, setSubMenuActive] = useState(false)

  const s = useSalon({ subMenuType })

  const ref = useRef(null)
  useOutsideClick(ref, () => {
    if (subMenuActive) {
      setSubMenuActive(false)
      onSubMenuToggle(false)
      setSubMenuType(null)
      onClose()
    }
  })

  const openSubMenu = (type) => {
    setSubMenuActive(true)
    onSubMenuToggle(true)
    setSubMenuType(type)
  }

  const closeSubMenu = () => {
    setSubMenuActive(false)
    setSubMenuType(null)
    // avoid trigger Tippy's onHide immediately
    setTimeout(() => {
      onSubMenuToggle(false)
    })
  }

  return (
    <div ref={ref} className={s.wrapper}>
      {!subMenuActive ? (
        <>
          <div className={s.menuItem} onClick={() => openSubMenu(SUB_MENU_TYPE.EDIT)}>
            <EditSVG className={s.icon} />
            <div className={s.menuTitle}>修改标题</div>
            <div className="grow" />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </div>

          <div className={s.menuItem} onClick={() => openSubMenu(SUB_MENU_TYPE.SLUG)}>
            <SlugSVG className={s.icon} />
            <div className={s.menuTitle}>设置路径</div>
            <div className="grow" />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </div>
          <div className={s.divider} />
          <CatItem onClick={() => openSubMenu(SUB_MENU_TYPE.CATEGORY)} />
          <StateItem onClick={() => openSubMenu(SUB_MENU_TYPE.STATE)} />
          <TagsItem onClick={() => openSubMenu(SUB_MENU_TYPE.TAGS)} />
          <div className={s.divider} />
          <PinItem />
          <div className={s.menuItem}>
            <LockSVG className={s.icon} />
            <div className={s.menuTitle}>关闭评论</div>
          </div>
          <div className={s.menuItem}>
            <MergeSVG className={s.icon} />
            <div className={s.menuTitle}>合并</div>
            <div className="grow" />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </div>
          <div className={s.menuItem}>
            <ArchivedSVG className={s.icon} />
            <div className={s.menuTitle}>归档</div>
          </div>
          <div className={s.menuItem} onClick={() => openSubMenu(SUB_MENU_TYPE.MIRROR)}>
            <ArticleMirror className={s.icon} />
            <div className={s.menuTitle}>镜像:Groupher</div>
            <div className="grow" />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </div>
          <div className={cn(s.menuItem, s.menuItemDanger)}>
            <DeleteSVG className={s.icon} />
            删除
          </div>
        </>
      ) : (
        <SubMenu closeSubMenu={closeSubMenu} subMenuType={subMenuType} />
      )}
    </div>
  )
}

export default memo(Menu)
