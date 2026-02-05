import PlusSVG from '~/icons/Plus'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'
import useTrans from '~/hooks/useTrans'

import useSalon from '../salon/admin/adder'

export default () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Input
        className={s.input}
        placeholder={t('dsb.admin.adder.placeholder')}
        width='w-full'
      />
      <Button className={s.addBtn}>
        <PlusSVG className={s.plusIcon} />
        {t('dsb.admin.adder.action')}
      </Button>
    </div>
  )
}
