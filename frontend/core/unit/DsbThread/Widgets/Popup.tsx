import useTrans from '~/hooks/useTrans'

import CodeArea from './CodeArea'
import useSalon from './salon'

export default function Popup() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>{t('dsb.widgets.popup.todo')}</div>
    </>
  )
}
