import useSalon from '../../salon/dashboard_intros/links_tab'
import ContentCard from './ContentCard'

export default function LinksTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
