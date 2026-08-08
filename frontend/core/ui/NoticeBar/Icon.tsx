import type { FC } from 'react'

import ArchivedSVG from '~/icons/Archived'
import InfoSVG from '~/icons/Info'
import LockSVG from '~/icons/Lock'
import NoticeSVG from '~/icons/Notice'

import { TYPE } from './constant'
import useSalon, { cn } from './salon/icon'
import type { TType } from './spec'

type TProps = {
  type: TType
}

const Icon: FC<TProps> = ({ type }) => {
  const s = useSalon()

  switch (type) {
    case TYPE.ARCHIVED: {
      return <ArchivedSVG className={cn(s.icon, s.lock)} />
    }
    case TYPE.LOCK: {
      return <LockSVG className={cn(s.icon, s.lock)} />
    }
    case TYPE.INFO: {
      return <InfoSVG className={s.icon} />
    }
    default: {
      return <NoticeSVG className={cn(s.icon, s.lock)} />
    }
  }
}

export default Icon
