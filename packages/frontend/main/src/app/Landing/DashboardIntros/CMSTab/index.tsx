import Tabs from './Tabs'
import ContentCard from './ContentCard'
import MenuCard from './MenuCard'

import useSalon from '../../salon/dashboard_intros/cms_tab'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Tabs />
      <ContentCard />
      <MenuCard />
    </div>
  )
}
