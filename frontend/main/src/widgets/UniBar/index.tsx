/* eslint-disable jsx-a11y/accessible-emoji */
/* eslint-disable react/jsx-no-comment-textnodes */
/*
 */

import { useState, useRef, useCallback } from 'react'

import useOutsideClick from '~/hooks/useOutsideClick'
import useTrans from '~/hooks/useTrans'

import { scrollToHeader } from '~/dom'

import ArrowTopSVG from '~/icons/Arrow2Top'
import NotifySVG from '~/icons/Notify'
import I18nSVG from '~/icons/I18n'
import MoreSVG from '~/icons/menu/MoreL'
import PeopleSVG from '~/icons/HeartPulse'

import ThemeSwitch from '~/widgets/ThemeSwitch'
import Tooltip from '~/widgets/Tooltip'

import I18nPanel from './I18nPanel'
import MorePanel from './MorePanel'
import NotifyPanel from './NotifyPanel'

import { MENU, TIP_OPTIONS } from './constant'
import useSalon, { cn } from './salon'

export default () => {
  const ref = useRef(null)
  const { t } = useTrans()

  const [expand, setExpand] = useState(false)
  const [menu, setMenu] = useState(MENU.DEFAULT.key)

  useOutsideClick(ref, () => {
    setExpand(false)
    setMenu(MENU.DEFAULT.key)
  })

  const handleOpenMenu = useCallback((menuKey: string) => {
    setMenu(menuKey)

    setTimeout(() => setExpand(true))
  }, [])

  const s = useSalon({ expand })

  // $menuHeight={MENU[menu].height}

  return (
    <div ref={ref} className={s.wrapper}>
      {menu === MENU.I18N.key && <I18nPanel />}
      {menu === MENU.MORE.key && <MorePanel />}
      {menu === MENU.NOTIFY.key && <NotifyPanel />}

      <div className={s.buttonBar}>
        <Tooltip content={<div className={s.tipText}>{t('to.top')}</div>} {...TIP_OPTIONS}>
          <div className={s.topBox} onClick={() => scrollToHeader()}>
            <ArrowTopSVG className={s.icon} />
          </div>
        </Tooltip>

        <Tooltip content={<div className={s.tipText}>{t('mention.msg')}</div>} {...TIP_OPTIONS}>
          <div
            className={cn(s.iconBox, menu === MENU.NOTIFY.key && s.iconActive)}
            onClick={() => {
              setMenu(MENU.NOTIFY.key)
              setExpand(true)
            }}
          >
            <NotifySVG className={s.icon} />
          </div>
        </Tooltip>

        <Tooltip content={<div className={s.tipText}>{t('active.users')}</div>} {...TIP_OPTIONS}>
          <div
            className={cn(s.iconBox, menu === MENU.PEOPLE.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.PEOPLE.key)}
          >
            <PeopleSVG className={cn(s.icon, menu === MENU.PEOPLE.key && s.iconPeopleActive)} />
          </div>
        </Tooltip>
        <Tooltip content={<div className={s.tipText}>{t('locale')}</div>} {...TIP_OPTIONS}>
          <div
            className={cn(s.iconBox, menu === MENU.I18N.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.I18N.key)}
          >
            <I18nSVG className={s.iconI18n} />
          </div>
        </Tooltip>
        <Tooltip content={<div className={s.tipText}>{t('theme')}</div>} {...TIP_OPTIONS}>
          <div className={s.iconBox}>
            <ThemeSwitch />
          </div>
        </Tooltip>
        <Tooltip content={<div className={s.tipText}>{t('more')}</div>} {...TIP_OPTIONS}>
          <div
            className={cn(s.iconBox, menu === MENU.MORE.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.MORE.key)}
          >
            <MoreSVG className={s.icon} />
          </div>
        </Tooltip>
      </div>
      <div className={s.shadowMask} />
    </div>
  )
}
