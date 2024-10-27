import EditSVG from '~/icons/EditPen'
import WechatSVG from '~/icons/social/WeChat'
import TwitterSVG from '~/icons/TwitterX'

import useSalon, { cn } from '../../salon/dashboard_intros/links_tab/content'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.ogPanel}>
        <div className={s.title}>社区图标</div>
        <div className={s.logo} />
        <div className={s.title}>社区名称</div>
        <div className={s.desc}>Tiki-taka</div>
        <div className={s.title}>社区简介</div>
        <div className={s.desc}>Visca Barca Visca Catalunya!</div>
        <div className={s.title}>社交媒体</div>

        <div className={cn(s.iconBox, 'top-52')}>
          <WechatSVG className={s.icon} />
        </div>
        <div className={cn(s.bar, 'top-52 left-8 mt-1')} />

        <div className={cn(s.iconBox, 'top-56 mt-2')}>
          <TwitterSVG className={s.icon} />
        </div>

        <div className={cn(s.bar, 'top-56 left-8 mt-3')} />
      </div>
      <div className={s.editBox}>
        <EditSVG className={s.editIcon} />
      </div>
      <div className={s.twPanel}>
        <div className={cn(s.title, 'mb-2')}>页眉链接</div>
        <div className={s.linkDesc}>游乐场</div>
        <div className={s.linkDesc}>价格</div>

        <div className={cn(s.bar, 'top-10 right-12')} />
        <div className={cn(s.bar, 'top-14 mt-1 right-12')} />

        <div className={cn(s.title, 'mt-5 mb-2')}>页脚链接</div>
        <div className={s.linkDesc}>梅西</div>
        <div className={s.linkDesc}>哈维</div>
        <div className={s.linkDesc}>小白</div>
        <div className={s.linkDesc}>布教授</div>

        <div className={cn(s.bar, 'top-28 mt-1.5 right-12')} />
        <div className={cn(s.bar, 'top-36 right-12 -mt-0.5')} />

        <div className={cn(s.bar, 'top-44 right-10 -mt-3 w-12')} />
        <div className={cn(s.bar, 'top-48 right-12 -mt-1.5')} />

        <div className={cn(s.bar, 'top-56 right-10 -mt-1 w-28 opacity-10')} />
        <div className={cn(s.bar, 'top-60 right-10 -mt-1 w-28 opacity-5')} />
      </div>
    </div>
  )
}
