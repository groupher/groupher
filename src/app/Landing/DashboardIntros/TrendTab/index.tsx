import ContentCard from './ContentCard'

import useSalon from '../../salon/dashboard_intros/trend_tab'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
