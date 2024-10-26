import ContentCard from './ContentCard'
import Footer from './Footer'

import useSalon from '../../styles/dashboard_intros/tags_tab'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
      <Footer />
    </div>
  )
}
