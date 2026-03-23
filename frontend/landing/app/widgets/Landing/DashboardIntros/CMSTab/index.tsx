import useSalon from '../../salon/dashboard_intros/cms_tab'
import ContentCard from './ContentCard'
import MenuCard from './MenuCard'
import Tabs from './Tabs'

export default function CMSTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Tabs />
      <ContentCard />
      <MenuCard />
    </div>
  )
}
