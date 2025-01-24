import HeaderCard from './HeaderCard'
import Content from './Content'
import FooterCard from './FooterCard'

import LineSVG from '../../salon/dashboard_intros/import_tab/Line'

import useSalon, { cn } from '../../salon/dashboard_intros/import_tab/content_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.bot, 'left-8 top-56 mt-2')}>Bot</div>
      <div className={cn(s.ai, 'right-9 top-56 mt-1')}>AI</div>
      <div className={s.BgBubble} />
      <LineSVG className={s.lLine} />
      <LineSVG className={s.rLine} />

      <div className={cn(s.dot, 'top-20 left-24')} />
      <div className={cn(s.dot, 'top-28 left-32 size-1.5 opacity-15')} />

      <div className={cn(s.dot, 'top-20 right-20')} />
      <div className={cn(s.dot, 'top-28 right-28 size-1.5 opacity-15')} />

      <div className={cn(s.dot, 'bottom-20 left-24 size-1.5 opacity-15')} />
      <div className={cn(s.dot, 'bottom-28 left-32')} />

      <div className={cn(s.dot, 'bottom-20 right-20')} />
      <div className={cn(s.dot, 'bottom-28 right-28 size-1.5 opacity-15')} />

      <HeaderCard />
      <Content />
      <FooterCard />
    </div>
  )
}
