import Link from 'next/link'

import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import DemoSVG from '~/icons/DemoTV'
import ThemeSwitch from '~/widgets/ThemeSwitch'

import IntroLinks from './IntroLinks'
import useSalon from './salon'

const HomeHeader = () => {
  const s = useSalon()

  useSession()

  return (
    <header className={s.normal}>
      <IntroLinks />

      <div className={s.extraInfo}>
        <ThemeSwitch />
        <div className={s.divider} />
        <Link className={s.requestDemoLink} href={`/${ROUTE.BOOK_DEMO}`}>
          <DemoSVG className={s.demoIcon} />
          <div>预约演示</div>
        </Link>
      </div>
    </header>
  )
}

export default HomeHeader
