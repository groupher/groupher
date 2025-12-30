import ArrowSimple from '~/icons/ArrowSimple'
import BadSVG from '~/icons/EmojiBad'
import GoodSVG from '~/icons/EmojiGood'
import SosoSVG from '~/icons/EmojiSoSo'
import ShareSVG from '~/icons/Share'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/help_tab/help_demo/article'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.underPaper} />

      <div className={s.inner}>
        <div className={s.content}>
          <ShareSVG className={s.shareIcon} />
          <div className={s.title}>自定义帮助台封面</div>

          <div className={s.coverWrapper}>
            <div className={s.slash} />
            <div className={cn(s.coverText, 'left-5')}>卡片视图</div>
            <div className={cn(s.coverText, 'right-7')}>列表视图</div>
          </div>

          <div className={cn(s.bar, 'w-44')} />
          <div className={cn(s.bar, 'w-52')} />
          <div className={cn(s.bar, 'opacity-30')} />
          <div className={cn(s.bar, 'opacity-25')} />
          <div className={cn(s.bar, 'w-52 opacity-20')} />
          <div className={cn(s.bar, 'opacity-20')} />
          <div className={cn(s.bar, 'opacity-15 w-20')} />
        </div>

        <div className={s.commentDot}>
          <div className={s.commentSolid} />
        </div>

        <div className={s.footer}>
          <ArrowSimple className={s.arrowIcon} />
          <div className={s.arrowText}>编辑目录</div>
          <div className='grow' />
          <div className={s.arrowText}>文档反馈</div>
          <ArrowSimple className={cn(s.arrowIcon, 'rotate-180')} />
        </div>

        <div className={s.feedback}>
          <GoodSVG className={s.feedIcon} />
          <SosoSVG className={s.feedIcon} />
          <BadSVG className={s.feedIcon} />
        </div>
      </div>
    </div>
  )
}
