import useSalon from '../../salon/dashboard_intros/integrate_tab'
import ContentCard from './ContentCard'

export default function IntegrateTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
