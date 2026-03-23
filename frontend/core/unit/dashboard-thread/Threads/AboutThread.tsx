import { type FC, memo } from 'react'
import useTrans from '~/hooks/useTrans'
import type { TEnableConf } from '~/spec'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import useEnable from '../logic/useEnable'
import useSalon from '../salon/threads/doc_thread'

type TProps = {
  settings: TEnableConf
}

const AboutThread: FC<TProps> = ({ settings }) => {
  const s = useSalon()
  const { enableThread } = useEnable()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <section className={s.section}>
        <div className={s.header}>
          <h3 className={s.title}>{t('dsb.threads.about.tech_stack.title')}</h3>
          <div className='grow' />
          <ToggleSwitch
            checked={settings.aboutTechstack}
            onChange={(c) => enableThread('aboutTechstack', c)}
          />
        </div>
        <p className={s.desc}>{t('dsb.threads.about.tech_stack.desc')}</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>{t('dsb.threads.about.location.title')}</h4>
          <div className='grow' />
          <ToggleSwitch
            checked={settings.aboutLocation}
            onChange={(c) => enableThread('aboutLocation', c)}
          />
        </div>
        <p className={s.desc}>{t('dsb.threads.about.location.desc')}</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>{t('dsb.threads.about.links.title')}</h4>
          <div className='grow' />
          <ToggleSwitch
            checked={settings.aboutLinks}
            onChange={(c) => enableThread('aboutLinks', c)}
          />
        </div>
        <p className={s.desc}>{t('dsb.threads.about.links.desc')}</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>{t('dsb.threads.about.media.title')}</h4>
          <div className='grow' />
          <ToggleSwitch
            checked={settings.aboutMediaReport}
            onChange={(c) => enableThread('aboutMediaReport', c)}
          />
        </div>
        <p className={s.desc}>{t('dsb.threads.about.media.desc')}</p>
      </section>
    </div>
  )
}

export default memo(AboutThread)
