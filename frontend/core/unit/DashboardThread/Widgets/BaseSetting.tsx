import { includes } from 'ramda'

import { THREAD } from '~/const/thread'
import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../constant'
import useWidgets from '../logic/useWidgets'
import useSalon, { cn } from '../salon/widgets/base_setting'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'

export default function BaseSetting() {
  const s = useSalon()
  const { t } = useTrans()

  const {
    widgetsPrimaryColor,
    widgetsThreads,
    isThreadTouched,
    isPrimaryColorTouched,
    edit,
    threadOnChange,
  } = useWidgets()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.widgets.primary_color.title')}
        desc={t('dsb.widgets.primary_color.desc')}
      />
      <SavingBar isTouched={isPrimaryColorTouched} field={FIELD.WIDGETS_PRIMARY_COLOR} bottom={2}>
        <div className={s.label}>
          <ColorSelector
            activeColor={widgetsPrimaryColor}
            onChange={(color) => edit(color, 'widgetsPrimaryColor')}
            placement='right'
            offset={[-1, 15]}
          >
            <div className={s.theColor} />
          </ColorSelector>
        </div>
      </SavingBar>

      <div className='mt-8' />
      <SectionLabel title={t('dsb.widgets.threads.title')} desc={t('dsb.widgets.threads.desc')} />

      <div className={s.threads}>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>{t('dsb.widgets.threads.post.title')}</h3>
            <div className='grow' />
            <ToggleSwitch
              checked={includes(THREAD.POST, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.POST)}
            />
          </div>
          <div className={s.desc}>{t('dsb.widgets.threads.post.desc')}</div>
        </div>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>{t('dsb.widgets.threads.kanban.title')}</h3>
            <div className='grow' />
            <ToggleSwitch
              checked={includes(THREAD.KANBAN, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.KANBAN)}
            />
          </div>
          <div className={s.desc}>{t('dsb.widgets.threads.kanban.desc')}</div>
        </div>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>{t('dsb.widgets.threads.changelog.title')}</h3>
            <div className='grow' />
            <ToggleSwitch
              checked={includes(THREAD.CHANGELOG, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.CHANGELOG)}
            />
          </div>
          <div className={s.desc}>{t('dsb.widgets.threads.changelog.desc')}</div>
        </div>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>{t('dsb.widgets.threads.doc.title')}</h3>
            <div className='grow' />
            <ToggleSwitch
              checked={includes(THREAD.DOC, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.DOC)}
            />
          </div>
          <div className={s.desc}>{t('dsb.widgets.threads.doc.desc')}</div>
        </div>
      </div>

      <div className={cn(isThreadTouched ? 'mt-5' : 'mt-14')} />

      <SavingBar isTouched={isThreadTouched} field={FIELD.WIDGETS_THREADS} top={10} bottom={10} />
    </div>
  )
}
