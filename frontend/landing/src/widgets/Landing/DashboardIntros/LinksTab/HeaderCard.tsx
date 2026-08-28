import useSalon from '../../salon/dashboard_intros/links_tab/header_card'

export default function HeaderCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>
        <div className={s.communityLogo} />
        Tiki-taka
      </div>
      <div className={s.links}>
        <div className={s.linkName}>讨论</div>
        <div className={s.linkName}>看板</div>
        <div className={s.linkName}>更新日志</div>
        <div className={s.linkName}>游乐场</div>
      </div>
      <div className={s.bar} />
    </div>
  )
}
