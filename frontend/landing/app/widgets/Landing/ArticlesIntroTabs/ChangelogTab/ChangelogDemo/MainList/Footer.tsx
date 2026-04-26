import type { FC } from 'react'

import UpvoteSVG from '~/icons/Upvote'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile/LandingPage'

import useSalon from '../../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/main_list/footer'

type TProps = {
  upvotesCount?: number
  date?: string
}

const Footer: FC<TProps> = ({ upvotesCount = 24, date = '2013-12-01' }) => {
  const s = useSalon()

  const users = mockUsers(3)

  return (
    <div className={s.wrapper}>
      <div className={s.upvote}>
        <UpvoteSVG className={s.icon} />
        <div className={s.count}>{upvotesCount}</div>
      </div>
      <Facepile users={users} className='scale-75 gap-x-1 opacity-80' />
      <div className='grow' />
      <div className={s.date}>{date}</div>
    </div>
  )
}

export default Footer
