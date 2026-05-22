import useSalon, { cnMerge } from './salon'

type TProps = {
  title: string
}

export default function ClassicContent({ title }: TProps) {
  const s = useSalon()

  return (
    <div className={s.frame}>
      <div className={s.nav}>
        <h4 className={s.communityTitle}>{title}</h4>
        <div className={cnMerge(s.bar, s.navBar)} />
        <div className={s.circle} />
      </div>
      <div className={cnMerge(s.hDivider, 'mt-1.5 mb-5')} />

      <div className={s.mainClassic}>
        <div className={s.contentColumn}>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitleWide)} />
            <div className={cnMerge(s.bar, s.contentDigest)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.contentDigestWide)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitleWide)} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
          </div>
        </div>

        <div className={s.vDivider} />

        <div className={s.rightRail}>
          <div className={cnMerge(s.bar, s.primaryBar, s.primaryChip)} />
          <div className={cnMerge(s.bar, s.railItemShort)} />
          <div className={cnMerge(s.bar, s.railItemWide)} />
          <div className={cnMerge(s.bar, s.railItem)} />
          <div className={cnMerge(s.bar, s.footerItem)} />
        </div>
      </div>
    </div>
  )
}
