/*
 *
 * ArticleSettingMenu
 *
 */

import { type FC, useState } from 'react'
import SettingSVG from '~/icons/Setting'
import type { TSpace } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import Menu from './Menu'
import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
} & TSpace

const ArticleSettingMenu: FC<TProps> = ({ testid = 'article-setting-menu', ...spacing }) => {
  const s = useSalon({ ...spacing })

  const [visible, setVisible] = useState(null)
  const [subMenuOpen, setSubMenuOpen] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const doClose = () => {
    setSubMenuOpen(null)
    setVisible(false)
    setMenuOpen(false)

    setTimeout(() => {
      setVisible(null)
    })
  }

  return (
    <div className={s.wrapper}>
      <Tooltip
        visible={visible}
        content={<Menu onSubMenuToggle={(t) => setSubMenuOpen(t)} onClose={doClose} />}
        placement='bottom-end'
        hideOnClick={false}
        offset={[0, 10]}
        onShow={() => {
          setMenuOpen(true)
          setVisible(true)
        }}
        onHide={() => {
          if (subMenuOpen) return
          doClose()
        }}
        trigger='click'
        noPadding
      >
        <div className={cn(s.settingBox, menuOpen && s.settingBoxActive)}>
          <SettingSVG className={s.settingIcon} />
        </div>
      </Tooltip>
    </div>
  )
}

export default ArticleSettingMenu
