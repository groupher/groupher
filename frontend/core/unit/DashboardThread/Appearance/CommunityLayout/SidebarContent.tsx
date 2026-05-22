import useSalon, { cnMerge } from './salon'

type TProps = {
  title: string
}

export default function SidebarContent({ title }: TProps) {
  const s = useSalon()

  return (
    <div className={s.frame}>
      <div className={s.nav}>
        <h4 className={s.communityTitle}>{title}</h4>
        <div className={s.navCenter}>
          <div className={cnMerge(s.bar, 'w-8')} />
          <div className={cnMerge(s.bar, s.primaryBar, s.primaryChip)} />
        </div>

        <div className={s.circle} />
      </div>

      <div className={s.mainSidebar}>
        <div className={s.sidebarNav}>
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sideNavItemWide)} />
          <div className={cnMerge(s.bar, s.sideNavActive)} />
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sideNavActive)} />
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sidebarBottom, 'mt-auto')} />
        </div>

        <div className={s.vDivider} />

        <div className={s.sidebarMain}>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle, 'w-1/2')} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.contentDigest)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, 'w-24')} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
            <div className={cnMerge(s.bar, 'w-16')} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, 'w-24')} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
            <div className={cnMerge(s.bar, 'w-16')} />
          </div>
        </div>
      </div>
    </div>
  )
}
