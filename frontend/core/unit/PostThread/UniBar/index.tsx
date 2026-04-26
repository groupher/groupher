/* eslint-disable jsx-a11y/accessible-emoji */
/* eslint-disable react/jsx-no-comment-text-nodes */

import { useCallback, useRef, useState } from 'react'

import { scrollToHeader } from '~/dom'
import useOutsideClick from '~/hooks/useOutsideClick'
import useTrans from '~/hooks/useTrans'
import ArrowTopSVG from '~/icons/Arrow2Top'
import PeopleSVG from '~/icons/HeartPulse'
import I18nSVG from '~/icons/I18n'
import MoreSVG from '~/icons/menu/MoreL'
import NotifySVG from '~/icons/Notify'
import ThemeSwitch from '~/widgets/ThemeSwitch'
import Tooltip from '~/widgets/Tooltip'

import { MENU, TIP_OPTIONS } from './constant'
import I18nPanel from './I18nPanel'
import MorePanel from './MorePanel'
import NotifyPanel from './NotifyPanel'
import useSalon, { cn } from './salon'

export default function UniBar() {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTrans()

  const [expand, setExpand] = useState(false)
  const [menu, setMenu] = useState(MENU.DEFAULT.key)

  useOutsideClick(ref, () => {
    setExpand(false)
    setMenu(MENU.DEFAULT.key)
  })

  const handleOpenMenu = useCallback(
    (menuKey: string) => {
      if (expand) {
        setMenu(MENU.DEFAULT.key)
        setTimeout(() => setExpand(false), 0)
        return
      }

      setMenu(menuKey)
      setTimeout(() => setExpand(true), 0)
    },
    [expand],
  )

  const s = useSalon({ expand })

  return (
    <div ref={ref} className={s.wrapper}>
      <div className={s.panelWrapper}>
        {menu === MENU.I18N.key && <I18nPanel />}
        {menu === MENU.MORE.key && <MorePanel />}
        {menu === MENU.NOTIFY.key && <NotifyPanel />}
        {menu === MENU.PEOPLE.key && <div className={s.mockPeoplePanel}>Active users…</div>}
      </div>

      <div className={s.buttonBar}>
        <Tooltip content={<div className={s.tipText}>{t('to.top')}</div>} {...TIP_OPTIONS}>
          <button type='button' className={s.topBox} onClick={() => scrollToHeader()}>
            <ArrowTopSVG className={s.icon} />
          </button>
        </Tooltip>

        <Tooltip content={<div className={s.tipText}>{t('mention.msg')}</div>} {...TIP_OPTIONS}>
          <button
            type='button'
            className={cn(s.iconBox, menu === MENU.NOTIFY.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.NOTIFY.key)}
          >
            <NotifySVG className={s.icon} />
          </button>
        </Tooltip>

        <Tooltip content={<div className={s.tipText}>{t('active.users')}</div>} {...TIP_OPTIONS}>
          <button
            type='button'
            className={cn(s.iconBox, menu === MENU.PEOPLE.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.PEOPLE.key)}
          >
            <PeopleSVG className={cn(s.icon, menu === MENU.PEOPLE.key && s.iconPeopleActive)} />
          </button>
        </Tooltip>

        <Tooltip content={<div className={s.tipText}>{t('locale')}</div>} {...TIP_OPTIONS}>
          <button
            type='button'
            className={cn(s.iconBox, menu === MENU.I18N.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.I18N.key)}
          >
            <I18nSVG className={s.iconI18n} />
          </button>
        </Tooltip>

        <div className={s.iconBox}>
          <ThemeSwitch />
        </div>

        <Tooltip content={<div className={s.tipText}>{t('more')}</div>} {...TIP_OPTIONS}>
          <button
            type='button'
            className={cn(s.iconBox, menu === MENU.MORE.key && s.iconActive)}
            onClick={() => handleOpenMenu(MENU.MORE.key)}
          >
            <MoreSVG className={s.icon} />
          </button>
        </Tooltip>
      </div>

      <div className={s.shadowMask} />
    </div>
  )
}
