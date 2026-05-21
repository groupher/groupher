import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../Table/salon/filter_bar/action_bar'

type TProps = {
  onCancel: () => void
  selectedCount: number
}

const ActionBar: FC<TProps> = ({ onCancel, selectedCount }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <div className={s.note}>
          {t('dsb.cms.action.selected_prefix')} <div className={s.focus}>{selectedCount}</div>
          {t('dsb.cms.action.selected_suffix')}
        </div>
        <div className={s.actionNotes}>
          <div className={s.note}>{t('dsb.cms.action.label')}</div>
          <div className={s.deleteNote}>{t('dsb.cms.action.delete')}</div>
        </div>
        <div className='grow' />
        <Button size='small' ghost noBorder onClick={onCancel}>
          {t('dsb.cms.action.cancel')}
        </Button>
        <Button size='small' space={2}>
          {t('dsb.cms.action.confirm')}
        </Button>
      </div>
    </div>
  )
}

export default ActionBar
