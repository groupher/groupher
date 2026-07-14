import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useSalon from './salon'

type TProps = {
  totalCount: number
}

const TrashToolbar: FC<TProps> = ({ totalCount }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.toolbar}>
      <div className={s.summary}>
        {t('dsb.cms.trash.summary')}
        <span className={s.summaryCount}>{totalCount}</span>
      </div>
      <div className={s.retentionHint}>{t('dsb.cms.trash.retention_hint')}</div>
    </div>
  )
}

export default TrashToolbar
