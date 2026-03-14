import Input from '~/widgets/Input'
import Radio from '~/widgets/Switcher/Radio'
import useTrans from '~/hooks/useTrans'

import useSalon from '../salon/widgets'
import CodeArea from './CodeArea'

export default function Drawer() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>{t('dsb.widgets.drawer.hint')}</div>

      <div className='mt-8' />

      <div className={s.inputWrapper}>
        <div className={s.inputLabel}>{t('dsb.widgets.drawer.target_id')}</div>
        <Input className={s.input} />
      </div>
      <div className={s.inputWrapper}>
        <div className={s.inputLabel}>{t('dsb.widgets.drawer.size')}</div>
        <Radio
          size='small'
          items={[
            {
              value: t('dsb.widgets.drawer.size.small'),
              key: '1',
            },
            {
              value: t('dsb.widgets.drawer.size.medium'),
              key: '2',
              dimOnActive: true,
            },
            {
              value: t('dsb.widgets.drawer.size.large'),
              key: '3',
              dimOnActive: true,
            },
          ]}
          activeKey='1'
        />
      </div>
    </>
  )
}
