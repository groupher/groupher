import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'

import { DOC_RETURN_TO_KEY } from '../constant'
import useSalon from '../salon/side_menu/sub_menu_back'

type TProps = {
  currentBase: string
  dashboardBase: string
  fallbackHref: string
  title?: Parameters<ReturnType<typeof useTrans>['t']>[0]
}

export default function SubMenuBack({
  currentBase,
  dashboardBase,
  fallbackHref,
  title = 'dsb.menu.doc.back',
}: TProps) {
  const router = useRouter()
  const { t } = useTrans()
  const s = useSalon()

  const handleBack = (e: MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault()

    const returnTo = sessionStorage.getItem(DOC_RETURN_TO_KEY)
    const isValidReturn = returnTo?.startsWith(dashboardBase) && !returnTo.startsWith(currentBase)

    router.push(isValidReturn ? returnTo : fallbackHref)
  }

  return (
    <Link className={s.back} href={fallbackHref} onClick={handleBack}>
      <ArrowSVG className={s.backIcon} />
      {t(title)}
    </Link>
  )
}
