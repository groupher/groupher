import Img from '~/Img'
import MarkdownSVG from '~/icons/Markdown'
import GithubSVG from '~/icons/social/Github'
import NotionSVG from '~/icons/social/Notion'

import useSalon, { cn } from '../../salon/dashboard_intros/import_tab/header_card'

export default function HeaderCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.imcard, 'rotate-3')}>
        <GithubSVG className={s.svgIcon} />
        <Img src='landing/products/gitlab.png' className={s.img} />
        <NotionSVG className={s.svgIcon} />
        <Img src='landing/products/linear.png' className={s.img} />
        <Img src='landing/products/jira.png' className={cn(s.img, 'size-6')} />
      </div>
      <div className={cn(s.imcard, s.otherCard, '-rotate-2')}>
        <MarkdownSVG className={s.svgIcon} />
        <Img src='landing/products/cvs.png' className={cn(s.img, 'size-6')} />
      </div>
    </div>
  )
}
