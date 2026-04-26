import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/danger_zone/confirm_footer'

type TProps = {
  testid?: string
} & TSpace

const ConfirmFooter: FC<TProps> = ({ testid: _testid = '', ...spacing }) => {
  const s = useSalon({ ...spacing })
  const { t } = useTrans()

  const { deleteCommunity } = useBaseInfo()

  const [msg, setMsg] = useState('')
  const { slug: community } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.note}>
        {t('dsb.base_info.danger.delete.confirm_prefix')}
        <span className={s.bold}>{community}</span>
        {t('dsb.base_info.danger.delete.confirm_suffix')}
      </div>
      <Input className={s.input} onChange={(e) => setMsg(e.target.value)} value={msg} autoFocus />
      <Button
        red
        top={14}
        bottom={18}
        disabled={msg !== community}
        onClick={() => deleteCommunity()}
      >
        {t('dsb.base_info.danger.delete.confirm_button')}
      </Button>
    </div>
  )
}

export default ConfirmFooter
