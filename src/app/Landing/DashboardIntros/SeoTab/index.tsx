import useSalon from '../../styles/dashboard_intros/seo_tab'

import ArticleCard from './ArticleCard'
import WebCard from './WebCard'
import Content from './Content'
import TwitterCard from './TwitterCard'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ArticleCard />
      <WebCard />
      <TwitterCard />
      <Content />
    </div>
  )
}
