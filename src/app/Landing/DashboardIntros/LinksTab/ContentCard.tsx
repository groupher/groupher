import HeaderCard from './HeaderCard'
import Content from './Content'
import FooterCard from './FooterCard'

import useSalon from '../../styles/dashboard_intros/links_tab/content_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <HeaderCard />
      <Content />
      <FooterCard />
    </div>
  )
}
