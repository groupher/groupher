import type { FC } from 'react'

import type { TActive } from '~/spec'

import IntroDigest from './IntroDigest'
import ChangelogDemo from './ChangelogDemo'

import useSalon, { cn } from '../../salon/articles_intro_tabs/changelog_tab'

const ChangelogFeat: FC<TActive> = ({ active }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, active && s.active)}>
      <IntroDigest />
      <div className={s.divider} />
      <ChangelogDemo />
    </div>
  )
}

export default ChangelogFeat
