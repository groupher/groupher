import TagBanner from './TagBanner'
import Sidebar from './Sidebar'
import useSalon, { cn } from '../../salon/dashboard_intros/tags_tab/content_card'

export default function ContentCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.shadowCover} />
      <div className={s.inner}>
        <div className={cn(s.bar, 'h-1.5 w-8 top-6 left-8 opacity-30')} />

        <div className={cn(s.bar, 'top-32 left-8')} />
        <div className={cn(s.bar, 'top-48 left-8 mt-3 opacity-10')} />
        <div className={cn(s.bar, 'top-72 left-8 -mt-2')} />

        <div className={cn(s.bar, 'h-20 top-32 left-36 opacity-10')} />
        <div className={cn(s.bar, 'h-28 top-56 left-36 opacity-5')} />

        <TagBanner />
        <Sidebar />
      </div>
    </div>
  )
}
