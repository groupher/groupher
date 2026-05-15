import Link from 'next/link'
import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'

import { MENU_VIEW } from '../constant'
import useSalon from '../salon/side_menu/sub_menu_back'
import { dispatchMenuView, resolveMainTab } from './events'

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
  const s = useSalon()
  const [backHref, setBackHref] = useState(fallbackHref)

  useEffect(() => {
    const isValidReturn = returnTo?.startsWith(dashboardBase) && !returnTo.startsWith(currentBase)

    setBackHref(isValidReturn ? returnTo : fallbackHref)
  }, [currentBase, dashboardBase, fallbackHref, returnTo])

  const switchToMainMenu = (): void => {
    dispatchMenuView({
      mainTab: resolveMainTab(backHref, dashboardBase),
      view: MENU_VIEW.MAIN,
    })
  }

  return (
    <Link className={s.back} href={backHref} onClick={switchToMainMenu}>
      <ArrowSVG className={s.backIcon} />
      {t(title)}
    </Link>
  )
}
