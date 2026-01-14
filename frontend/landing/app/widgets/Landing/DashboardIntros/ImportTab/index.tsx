import ContentCard from './ContentCard'

import useSalon from '../../salon/dashboard_intros/import_tab'

export default function ImportTab() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
