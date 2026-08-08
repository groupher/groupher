/*
 *
 * ArticleSettingMenu
 *
 */

import { type FC, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import SettingSVG from '~/icons/Setting'
import type { TSpace } from '~/spec'
import Tooltip from '~/ui/Tooltip'

import Menu from './Menu'
import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
} & TSpace

const ArticleSettingMenu: FC<TProps> = ({
  testid: _testid = 'article-setting-menu',
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const { t } = useTrans()

  const [visible, setVisible] = useState(false)
  const subMenuOpenRef = useRef(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const doClose = () => {
    subMenuOpenRef.current = false
    setVisible(false)
    setMenuOpen(false)
  }

  const handleToggle = () => {
    if (visible) {
      doClose()
      return
    }

    setVisible(true)
    setMenuOpen(true)
  }

  return (
    <div className={s.wrapper}>
      <Tooltip
        visible={visible}
        content={
          <Menu onSubMenuToggle={(open) => (subMenuOpenRef.current = open)} onClose={doClose} />
        }
        placement='bottom-end'
        hideOnClick={false}
        offset={[0, 10]}
        onShow={() => {
          setMenuOpen(true)
          setVisible(true)
        }}
        onHide={() => {
          if (subMenuOpenRef.current) return
          doClose()
        }}
        noPadding
      >
        <button
          type='button'
          className={cn(s.settingBox, menuOpen && s.settingBoxActive)}
          aria-label={t('article.settings')}
          aria-expanded={menuOpen}
          onClick={handleToggle}
        >
          <SettingSVG className={s.settingIcon} />
        </button>
      </Tooltip>
    </div>
  )
}

export default ArticleSettingMenu
