import { type FC, useState } from 'react'
import useCommunity from '~/hooks/useCommunity'
import type { TSpace } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/danger_zone/confirm_footer'

type TProps = {
  testid?: string
} & TSpace

const ConfirmFooter: FC<TProps> = ({ testid = '', ...spacing }) => {
  const s = useSalon({ ...spacing })

  const { deleteCommunity } = useBaseInfo()

  const [msg, setMsg] = useState('')
  const { slug: community } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.note}>
        请在下方输入社区名称<span className={s.bold}>{community}</span>确认
      </div>
      <Input className={s.input} onChange={(e) => setMsg(e.target.value)} value={msg} autoFocus />
      <Button
        type='red'
        top={14}
        bottom={18}
        disabled={msg !== community}
        onClick={() => deleteCommunity()}
      >
        我已了解，确认删除
      </Button>
    </div>
  )
}

export default ConfirmFooter
