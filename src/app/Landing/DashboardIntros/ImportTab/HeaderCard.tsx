import Img from '~/Img'

import GithubSVG from '~/icons/social/Github'

import useSalon, { cn } from '../../salon/dashboard_intros/import_tab/header_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.imcard, 'rotate-3')}>
        <GithubSVG className={s.svgIcon} />
        <Img src="landing/products/gitlab.png" className={s.img} />
        <Img src="landing/products/notion.png" className={s.img} />
        <Img src="landing/products/linear.png" className={s.img} />
        <Img src="landing/products/jira.png" className={cn(s.img, 'size-6')} />
      </div>
      <div className={cn(s.imcard, s.otherCard, '-rotate-2')}>
        <Img src="landing/products/markdown.png" className={cn(s.img, 'size-6')} />
        <Img src="landing/products/cvs.png" className={cn(s.img, 'size-6')} />
      </div>
    </div>
  )
}
