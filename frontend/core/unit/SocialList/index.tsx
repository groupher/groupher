import Link from 'next/link'
import { type FC, memo } from 'react'
import SIZE from '~/const/size'
import type { TSizeTSM, TSocialItem, TSpace } from '~/spec'

import useSalon, { cn, Icon } from './salon'

type TProps = {
  size?: TSizeTSM
  testid?: string
  selected?: readonly TSocialItem[]
} & TSpace

const SocialList: FC<TProps> = ({
  testid = 'social-list',
  selected = [],
  size = SIZE.SMALL,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div
      className={cn(s.wrapper, size === SIZE.TINY && 'scale-75', size === SIZE.TINY && 'scale-90')}
    >
      {selected.map((social) => {
        const socialType = String(social?.type || '').toUpperCase()
        const SocialIcon = Icon[socialType]
        if (!SocialIcon || !social?.link) return null

        return (
          <Link
            className={s.socialBox}
            key={`${socialType}-${social.link}`}
            href={social.link}
            target='_blank'
          >
            <SocialIcon className={s.icon} />
          </Link>
        )
      })}
    </div>
  )
}

export default memo(SocialList)
