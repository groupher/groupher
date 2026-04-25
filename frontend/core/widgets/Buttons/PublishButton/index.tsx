/*
 * PublishButton
 */
import { type FC, memo } from 'react'
import { ARTICLE_CAT } from '~/const/gtd'
import { POST_CAT_MENU_ITEMS } from '~/const/menu'
import { PUBLISH_MODE } from '~/const/mode'
import useViewingThread from '~/hooks/useViewingThread'
import ArrowSVG from '~/icons/ArrowSolid'
import type { TArticleCat, TPublishMode, TSpace, TTooltipPlacement } from '~/spec'

import Menu from '~/widgets/Menu'
import Button from '../Button'
import useSalon from '../salon/publish_button'
import { getText } from './helper'
// import { MORE_MENU } from './constant'
import PostLayout from './PostLayout'
import SidebarHeaderLayout from './SidebarHeaderLayout'

type TProps = {
  text?: string
  mode?: TPublishMode
  onMenuSelect?: (cat: TArticleCat) => void
  menuLeft?: boolean
  offset?: [number, number]
  placement?: TTooltipPlacement
} & TSpace

const PublishButton: FC<TProps> = ({
  text = '',
  mode = PUBLISH_MODE.DEFAULT,
  placement = 'bottom',
  onMenuSelect = console.log,
  _menuLeft = false,
  _offset = [-5, 5],
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const activeThread = useViewingThread()

  const _text = text || getText(activeThread)

  return (
    <div className={s.wrapper}>
      <div className={s.pubBtn}>
        <div className={s.mainBtn}>
          <Button space={2.5} noBorder noRightRound>
            {mode === PUBLISH_MODE.DEFAULT && <PostLayout text={_text} />}
            {mode === PUBLISH_MODE.SIDEBAR_LAYOUT_HEADER && <SidebarHeaderLayout text={text} />}
          </Button>
        </div>

        <div className={s.menuBtn}>
          <Menu
            offset={s.menuOffset as [number, number]}
            activeKey={ARTICLE_CAT.FEATURE}
            placement={placement}
            items={POST_CAT_MENU_ITEMS}
            onSelect={(item) => onMenuSelect(item.key as TArticleCat)}
            popWidth={48}
          >
            <Button width='w-full' space={0} className={s.arrowBtn} noLeftRound noBorder>
              <ArrowSVG className={s.arrowIcon} />
            </Button>
          </Menu>
        </div>
      </div>
    </div>
  )
}

export default memo(PublishButton)
