import useHover from '~/hooks/useHover'
import useTrans from '~/hooks/useTrans'
import useSalon from '../../salon/battery_bento/rich_content'
import Panel from './Panel'

export default function RichContent() {
  const s = useSalon()
  const { t } = useTrans()

  const [cardRef, isCardHovered] = useHover<HTMLDivElement>()

  return (
    <div ref={cardRef} className={s.wrapper}>
      <Panel hovering={isCardHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>{t('landing.battery.rich.title')}</h3>
        <div className={s.desc}>{t('landing.battery.rich.desc')}</div>
      </div>
    </div>
  )
}
