import ContentCard from './ContentCard'

import useSalon from '../../salon/dashboard_intros/links_tab'

export default function LinksTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
