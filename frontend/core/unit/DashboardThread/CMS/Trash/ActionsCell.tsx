import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'

import useSalon from './salon'
import type { TTrashedPost } from './spec'

type TProps = {
  item: TTrashedPost
  activeActionId: string | null
  onRestore: (id: string) => Promise<boolean>
  onRequestPermanentDelete: (item: TTrashedPost) => void
}

const ActionsCell: FC<TProps> = ({ item, activeActionId, onRestore, onRequestPermanentDelete }) => {
  const s = useSalon()
  const { t } = useTrans()
  const busy = activeActionId !== null

  return (
    <div className={s.actions}>
      <Button
        size='small'
        ghost
        noBorder
        className={s.actionButton}
        loading={activeActionId === item.id}
        disabled={busy}
        onClick={() => void onRestore(item.id)}
      >
        {t('dsb.cms.trash.restore')}
      </Button>
      <Button
        size='small'
        ghost
        noBorder
        red
        className={s.actionButton}
        disabled={busy}
        onClick={() => onRequestPermanentDelete(item)}
      >
        {t('dsb.cms.trash.permanent_delete')}
      </Button>
    </div>
  )
}

export default ActionsCell
