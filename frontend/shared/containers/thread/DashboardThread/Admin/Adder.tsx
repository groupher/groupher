import Input from '~/widgets/Input'
import Button from '~/widgets/Buttons/Button'

import PlusSVG from '~/icons/Plus'

import useSalon from '../salon/admin/adder'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Input className={s.input} placeholder="账户名称 / 登入ID (TODO: use react-select)" />
      <Button className={s.addBtn} size="small">
        <PlusSVG className={s.plusIcon} />
        管理员
      </Button>
    </div>
  )
}
