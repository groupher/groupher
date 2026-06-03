import Link from 'next/link'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'

import { MENU_VIEW } from '../constant'
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
  const s = useSalon()
  const isValidReturn = returnTo?.startsWith(dashboardBase) && !returnTo.startsWith(currentBase)
  const backHref = isValidReturn ? returnTo : fallbackHref

  const switchToMainMenu = (): void => {
    dispatchMenuView({
      mainTab: resolveMainTab(backHref, dashboardBase),
      view: MENU_VIEW.MAIN,
    })
  }

  return (
    <Link className={s.wrapper} href={backHref} onClick={switchToMainMenu}>
      <ArrowSVG className={s.backIcon} />
      <div className={s.title}>{t(title)}</div>
    </Link>
  )
}
