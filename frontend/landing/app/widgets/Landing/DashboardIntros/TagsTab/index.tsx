import useSalon from '../../salon/dashboard_intros/tags_tab'
import ContentCard from './ContentCard'
import Footer from './Footer'

export default function TagsTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
      <Footer />
    </div>
  )
}
