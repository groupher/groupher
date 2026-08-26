import useSalon from '../../salon/dashboard_intros/seo_tab'
import ArticleCard from './ArticleCard'
import Content from './Content'
import TwitterCard from './TwitterCard'
import WebCard from './WebCard'

export default function SeoTab() {
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
