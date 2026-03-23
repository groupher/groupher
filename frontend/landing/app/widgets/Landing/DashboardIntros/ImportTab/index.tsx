import useSalon from '../../salon/dashboard_intros/import_tab'
import ContentCard from './ContentCard'

export default function ImportTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
