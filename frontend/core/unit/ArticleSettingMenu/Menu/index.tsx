import { GATE_ACTION } from '@groupher/contracts/gate'
import { useQuery } from '@tanstack/react-query'
import { type FC, memo, useRef, useState } from 'react'

import { ARTICLE_THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import useOutsideClick from '~/hooks/useOutsideClick'
import useViewingArticle from '~/hooks/useViewingArticle'
import ArchivedSVG from '~/icons/Archived'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import LockSVG from '~/icons/LockLight'
import MergeSVG from '~/icons/Merge'
import SlugSVG from '~/icons/Slug'
import DeleteSVG from '~/icons/Trash'
import useAccount from '~/stores/account/hooks'

import { SUB_MENU } from '../constant'
import S from '../schema'
import type { TSubMenu } from '../spec'
import SubMenu from '../SubMenu'
import CatItem from './CatItem'
import PinItem from './PinItem'
import useSalon, { cn } from './salon'
import TagsItem from './TagsItem'

type TProps = {
  onSubMenuToggle: (t: boolean) => void
  onClose: () => void
}

const Menu: FC<TProps> = ({ onSubMenuToggle, onClose }) => {
  const [subMenuType, setSubMenuType] = useState<TSubMenu>(null)
  const [subMenuActive, setSubMenuActive] = useState(false)

  const s = useSalon({ subMenuType })
  const { article, articlePath } = useViewingArticle()
  const { accountScope } = useAccount()
  const articleId = article.id ? String(article.id) : ''
  const permissionsQuery = useQuery({
    queryKey: ['article-settings-permissions', accountScope, articleId],
    queryFn: () => browserGraphQLRequest(S.articlePermissions, { articleId }),
    enabled: !!accountScope && !!articleId && articlePath?.thread === ARTICLE_THREAD.POST,
  })
  const canonicalPermissionNames = new Map(
    Object.keys(GATE_ACTION).map((key) => {
      const action = GATE_ACTION[key as keyof typeof GATE_ACTION]
      return [action.replaceAll('.', '_').toUpperCase(), action]
    }),
  )
  const canEditBody = (permissionsQuery.data?.articlePermissions?.permissions ?? []).some(
    (permission) =>
      (canonicalPermissionNames.get(String(permission)) ?? String(permission)) ===
      GATE_ACTION.ARTICLE_UPDATE,
  )

  const ref = useRef(null)
  useOutsideClick(ref, () => {
    if (subMenuActive) {
      setSubMenuActive(false)
      onSubMenuToggle(false)
      setSubMenuType(null)
      onClose()
    }
  })

  const openSubMenu = (type: Exclude<TSubMenu, null>) => {
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

          {articlePath?.thread === ARTICLE_THREAD.POST && canEditBody ? (
            <button type='button' className={s.menuItem} onClick={() => openSubMenu(SUB_MENU.BODY)}>
              <EditSVG className={s.icon} />
              <div className={s.menuTitle}>编辑正文</div>
              <div className='grow' />
              <ArrowSVG className={cn(s.icon, 'rotate-180')} />
            </button>
          ) : null}

          <button type='button' className={s.menuItem} onClick={() => openSubMenu(SUB_MENU.SLUG)}>
            <SlugSVG className={s.icon} />
            <div className={s.menuTitle}>设置路径</div>
            <div className='grow' />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </button>
          <div className={s.divider} />
          <CatItem onClick={() => openSubMenu(SUB_MENU.CATEGORY)} />
          <TagsItem onClick={() => openSubMenu(SUB_MENU.TAGS)} />
          <div className={s.divider} />
          <button
            type='button'
            className={s.menuItem}
            onClick={() => openSubMenu(SUB_MENU.HISTORY)}
          >
            <ArchivedSVG className={s.icon} />
            <div className={s.menuTitle}>历史记录</div>
            <div className='grow' />
            <ArrowSVG className={cn(s.icon, 'rotate-180')} />
          </button>
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
