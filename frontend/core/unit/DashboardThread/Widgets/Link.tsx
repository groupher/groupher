import useTrans from '~/hooks/useTrans'

import CodeArea from './CodeArea'
import useSalon from './salon'

export default function Link() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>{t('dsb.widgets.link.todo')}</div>
    </>
  )
}
