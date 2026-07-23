import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type MouseEvent, useRef } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'

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
  const router = useRouter()
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

  const handleBack = async (event: MouseEvent<HTMLAnchorElement>): Promise<void> => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    if (navigating.current) return

    navigating.current = true
    const canLeave = await runBeforeDashboardBack()
    if (!canLeave) {
      navigating.current = false
      return
    }

    switchToMainMenu()
    router.push(backHref)
  }

  return (
    <Link className={s.wrapper} href={backHref} onClick={handleBack}>
      <ArrowSVG className={s.backIcon} />
      <div className={s.title}>{t(title)}</div>
    </Link>
  )
}
