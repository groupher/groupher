import { type FC, memo, useRef, useState } from 'react'

import useOutsideClick from '~/hooks/useOutsideClick'
import ArchivedSVG from '~/icons/Archived'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import LockSVG from '~/icons/LockLight'
import MergeSVG from '~/icons/Merge'
import ArticleMirror from '~/icons/MirrorShoe'
import SlugSVG from '~/icons/Slug'
import DeleteSVG from '~/icons/Trash'

import { SUB_MENU } from '../constant'
import useSalon, { cn } from './salon'
import type { TSubMenu } from '../spec'
import SubMenu from '../SubMenu'
import CatItem from './CatItem'
import PinItem from './PinItem'
import StatusItem from './StatusItem'
import TagsItem from './TagsItem'

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
          <button type='button' className={s.menuItem} onClick={() => openSubMenu(SUB_MENU.EDIT)}>
            <EditSVG className={s.icon} />
            <div className={s.menuTitle}>修改标题</div>
            <div className='grow' />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </button>

          <button type='button' className={s.menuItem} onClick={() => openSubMenu(SUB_MENU.SLUG)}>
            <SlugSVG className={s.icon} />
            <div className={s.menuTitle}>设置路径</div>
            <div className='grow' />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </button>
          <div className={s.divider} />
          <CatItem onClick={() => openSubMenu(SUB_MENU.CATEGORY)} />
          <StatusItem onClick={() => openSubMenu(SUB_MENU.STATUS)} />
          <TagsItem onClick={() => openSubMenu(SUB_MENU.TAGS)} />
          <div className={s.divider} />
          <PinItem />
          <div className={s.menuItem}>
            <LockSVG className={s.icon} />
            <div className={s.menuTitle}>关闭评论</div>
          </div>
          <div className={s.menuItem}>
            <MergeSVG className={s.icon} />
            <div className={s.menuTitle}>合并</div>
            <div className='grow' />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </div>
          <div className={s.menuItem}>
            <ArchivedSVG className={s.icon} />
            <div className={s.menuTitle}>归档</div>
          </div>
          <button type='button' className={s.menuItem} onClick={() => openSubMenu(SUB_MENU.MIRROR)}>
            <ArticleMirror className={s.icon} />
            <div className={s.menuTitle}>镜像:Groupher</div>
            <div className='grow' />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </button>
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
