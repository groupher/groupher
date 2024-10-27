import ContentCard from './ContentCard'

import useSalon from '../../styles/dashboard_intros/import_tab'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
    </div>
  )
}
