import useSalon, { cnMerge } from './salon'

type TProps = {
  title: string
}

export default function HeroContent({ title }: TProps) {
  const s = useSalon()

  return (
    <div className={s.mainCover}>
      <div className={s.coverHero} />
      <div className={s.coverHeader}>
        <div className={s.coverLead}>
          <div className={cnMerge(s.bar, s.coverAvatar)} />
          <h4 className={s.communityTitle}>{title}</h4>
        </div>
        <div className={cnMerge(s.bar, s.primaryBar, s.primaryChip, s.coverAction)} />
      </div>

      <div className={s.coverContent}>
        <div className={s.coverMain}>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.coverBodyShort)} />
          </div>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle, 'w-1/2')} />
            <div className={cnMerge(s.bar, s.coverBodyLong)} />
          </div>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.coverBodyLong)} />
          </div>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle, 'w-1/2')} />
            <div className={cnMerge(s.bar, s.coverBodyLong, 'w-1/3')} />
          </div>
        </div>

        <div className={s.rightRail}>
          <div className={cnMerge(s.bar, s.railItemShort)} />
          <div className={cnMerge(s.bar, s.railItemWide)} />
          <div className={cnMerge(s.bar, s.railItem)} />
          <div className={cnMerge(s.bar, s.footerItem, 'mt-auto')} />
        </div>
      </div>
    </div>
  )
}
