import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import useTrans from '~/hooks/useTrans'
import useEnable from '../logic/useEnable'
import SectionLabel from '../SectionLabel'
import useSalon from '../salon/threads'
import AboutThread from './AboutThread'
import DocThread from './DocThread'

export default function Threads() {
  const s = useSalon()
  const { enable: settings, enableThread } = useEnable()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className='mb-10' />

      <SectionLabel
        title={t('dsb.threads.post.title')}
        desc={t('dsb.threads.post.desc')}
        addon={
          <ToggleSwitch
            size='small'
            checked={settings.post}
            onChange={(c) => enableThread('post', c)}
          />
        }
      />
      <div className={s.divider} />
      <SectionLabel
        title={t('dsb.threads.kanban.title')}
        desc={t('dsb.threads.kanban.desc')}
        addon={
          <ToggleSwitch checked={settings.kanban} onChange={(c) => enableThread('kanban', c)} />
        }
      />
      <div className={s.divider} />
      <SectionLabel
        title={t('dsb.threads.changelog.title')}
        desc={t('dsb.threads.changelog.desc')}
        addon={
          <ToggleSwitch
            checked={settings.changelog}
            onChange={(c) => enableThread('changelog', c)}
          />
        }
      />
      <div className={s.divider} />
      <SectionLabel
        title={t('dsb.threads.doc.title')}
        desc={t('dsb.threads.doc.desc')}
        addon={<ToggleSwitch checked={settings.doc} onChange={(c) => enableThread('help', c)} />}
      />
      {settings.doc && <DocThread settings={settings} />}

      <div className={s.divider} />

      <SectionLabel
        title={t('dsb.threads.about.title')}
        desc={t('dsb.threads.about.desc')}
        addon={<ToggleSwitch checked={settings.about} onChange={(c) => enableThread('about', c)} />}
      />
      {settings.about && <AboutThread settings={settings} />}
    </div>
  )
}
