import type { FC } from 'react'

import type { TActive } from '~/spec'

import useSalon, { cn } from '../../salon/articles_intro_tabs/help_tab'
import HelpDemo from './HelpDemo'
import IntroDigest from './IntroDigest'

const HelpFeat: FC<TActive> = ({ active }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, active && s.active)}>
      <IntroDigest />
      <HelpDemo />
    </div>
  )
}

export default HelpFeat
