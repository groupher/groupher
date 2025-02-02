import type { FC } from 'react'

import ArchivedSVG from '~/icons/Archived'
import LockSVG from '~/icons/Lock'
import NoticeSVG from '~/icons/Notice'
import InfoSVG from '~/icons/Info'

import type { TType } from './spec'
import { TYPE } from './constant'

import useSalon, { cn } from './salon/icon'

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
