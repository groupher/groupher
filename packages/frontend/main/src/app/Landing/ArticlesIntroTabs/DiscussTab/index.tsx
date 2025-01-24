import type { FC } from 'react'

import type { TActive } from '~/spec'

import IntroDigest from './IntroDigest'
import DiscussDemo from './DiscussDemo'

import useSalon, { cn } from '../../salon/articles_intro_tabs/discuss_tab'

const DiscussFeat: FC<TActive> = ({ active }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, active && s.active)}>
      <IntroDigest />
      <div className={s.divider} />
      <DiscussDemo />
    </div>
  )
}

export default DiscussFeat
