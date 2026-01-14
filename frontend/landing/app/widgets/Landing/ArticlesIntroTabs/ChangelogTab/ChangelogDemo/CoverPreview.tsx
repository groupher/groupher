import CardsSVG from '~/icons/Cards'
import Cards2SVG from '~/icons/Cards2'

import useSalon, {
  cn,
} from '../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/cover_preview'

export default function CoverPreview() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.dot, ' left-2')} />
      <div className={cn(s.dot, ' left-5')} />
      <div className={cn(s.dot, ' left-8')} />

      <div className={s.cardsWrapper}>
        <CardsSVG className={s.cardsIcon} />
        <Cards2SVG className={s.cardsIcon} />
      </div>
    </div>
  )
}
