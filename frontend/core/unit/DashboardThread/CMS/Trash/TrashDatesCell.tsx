import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import TimeAgo from '~/widgets/TimeAgo'

import useSalon from './salon'
import type { TTrashedPost } from './spec'

type TProps = {
  item: TTrashedPost
}

const TrashDatesCell: FC<TProps> = ({ item }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.dates}>
      <div className={s.dateLine}>
        <span>{t('dsb.cms.trash.deleted')}</span>
        <TimeAgo datetime={item.deletedAt} />
      </div>
      <div className={s.permanentDateLine}>
        <span>{t('dsb.cms.trash.permanent_on')}</span>
        <TimeAgo datetime={item.scheduledPermanentDeletionAt} />
      </div>
    </div>
  )
}

export default TrashDatesCell
