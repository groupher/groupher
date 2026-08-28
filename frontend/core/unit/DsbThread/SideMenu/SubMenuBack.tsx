import { useLocation, useNavigate } from '@tanstack/react-router'
import { type MouseEvent, useRef } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import { dsbRoutes, parseDsbPathname, resolveDsbRoute, toDsbTargetFromPath } from '~/platform'

import { MENU_VIEW } from '../constant'
import { runBeforeDashboardBack } from './beforeBack'
import { dispatchMenuView, resolveMainTab } from './events'
import useSalon from './salon/sub_menu_back'

type TProps = {
  currentBase: string
  dashboardBase: string
  fallbackHref: string
  returnTo: string | null
  title?: Parameters<ReturnType<typeof useTrans>['t']>[0]
}

export default function SubMenuBack({
  currentBase,
  dashboardBase,
  fallbackHref,
  returnTo,
  title = 'dsb.menu.doc.back',
}: TProps) {
  const { t } = useTrans()
  const { pathname, searchStr } = useLocation()
  const navigate = useNavigate()
  const meta = parseDsbPathname(pathname)
  const community = meta?.community ?? ''
  const s = useSalon()
  const navigating = useRef(false)
  const isValidReturn = returnTo?.startsWith(dashboardBase) && !returnTo.startsWith(currentBase)
  const backHref = isValidReturn ? returnTo : fallbackHref

  const switchToMainMenu = (): void => {
    dispatchMenuView({
      mainTab: resolveMainTab(backHref, dashboardBase),
      view: MENU_VIEW.MAIN,
    })
  }

  const handleBack = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault()
    if (navigating.current) return

    navigating.current = true
    const canLeave = await runBeforeDashboardBack()
    if (!canLeave) {
      navigating.current = false
      return
    }

    switchToMainMenu()
    const target = toDsbTargetFromPath(backHref)
    if (target) {
      void navigate({
        to: resolveDsbRoute(target, { currentSearch: new URLSearchParams(searchStr) }) as never,
      })
    } else if (community) {
      void navigate({
        to: resolveDsbRoute(dsbRoutes.overview({ community }), {
          currentSearch: new URLSearchParams(searchStr),
        }) as never,
      })
    }
    navigating.current = false
  }

  return (
    <button type='button' className={s.wrapper} onClick={handleBack} aria-label={t(title)}>
      <ArrowSVG className={s.backIcon} />
      <div className={s.title}>{t(title)}</div>
    </button>
  )
}
