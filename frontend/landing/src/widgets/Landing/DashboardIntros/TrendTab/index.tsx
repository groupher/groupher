import useSalon from '../../salon/dashboard_intros/trend_tab'
import ContentCard from './ContentCard'

export default function TrendTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
