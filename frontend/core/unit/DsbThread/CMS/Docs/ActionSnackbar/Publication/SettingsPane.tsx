import { useState, type FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useSalon from './salon'

type Props = {
  required: boolean
  selfApproval: boolean
  busy: boolean
  onSave: (required: boolean, self: boolean) => void
}
const SettingsPane: FC<Props> = ({ required, selfApproval, busy, onSave }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [nextRequired, setRequired] = useState(required)
  const [nextSelf, setSelf] = useState(selfApproval)
  return (
    <div className={s.panel}>
      <label>
        <input
          type='checkbox'
          checked={nextRequired}
          onChange={(e) => setRequired(e.target.checked)}
        />{' '}
        {t('dsb.doc.publication.require_approval')}
      </label>
      <label>
        <input type='checkbox' checked={nextSelf} onChange={(e) => setSelf(e.target.checked)} />{' '}
        {t('dsb.doc.publication.self_approval')}
      </label>
      <p className={s.text}>{t('dsb.doc.publication.policy_hint')}</p>
      <button
        type='button'
        className={s.button}
        disabled={busy}
        onClick={() => onSave(nextRequired, nextSelf)}
      >
        {t('dsb.doc.publication.save_policy')}
      </button>
    </div>
  )
}
export default SettingsPane
