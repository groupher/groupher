import useSalon from '../../salon/dashboard_intros/layout_tab'
import ContentCard from './ContentCard'
import WallpaperCard from './WallpaperCard'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ContentCard />
      <WallpaperCard />
    </div>
  )
}
