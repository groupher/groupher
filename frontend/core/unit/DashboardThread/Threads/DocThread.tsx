import { type FC, memo } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TEnableConf } from '~/spec'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import useEnable from '../logic/useEnable'
import useSalon from './salon/doc_thread'

type TProps = {
  settings: TEnableConf
}

const DocThread: FC<TProps> = ({ settings }) => {
  const s = useSalon()
  const { enableThread } = useEnable()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>{t('dsb.threads.doc.last_update.title')}</h4>
          <div className='grow' />
          <ToggleSwitch
            checked={settings.docLastUpdate}
            onChange={(c) => enableThread('helpLastUpdate', c)}
          />
        </div>
        <p className={s.desc}>{t('dsb.threads.doc.last_update.desc')}</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>{t('dsb.threads.doc.feedback.title')}</h4>
          <div className='grow' />
          <ToggleSwitch
            checked={settings.docReaction}
            onChange={(c) => enableThread('docReaction', c)}
          />
        </div>
        <p className={s.desc}>{t('dsb.threads.doc.feedback.desc')}</p>
      </section>
    </div>
  )
}

export default memo(DocThread)
