import useSalon, { cn } from '../../styles/dashboard_intros/seo_tab/content'

import SpiderSVG from '~/icons/Spider'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.ogPanel}>
        <div className={s.title}>ogUrl</div>
        <div className={s.desc}>https://motuojie.com</div>
        <div className={s.title}>ogTitle</div>
        <div className={s.desc}>Motuojie - (摩界)</div>
        <div className={s.title}>ogDescription</div>
        <div className={s.desc}>发现复古摩托车的魅力...</div>
        <div className={cn(s.bar, 'w-16 -bottom-2 left-6')} />
        <div className={cn(s.bar, '-bottom-5 opacity-15 left-6')} />
      </div>
      <div className={s.line} />
      <div className={s.iconBox}>
        <SpiderSVG className={s.spiderSVG} />
      </div>
      <div className={s.twPanel}>
        <div className={s.title}>twUrl</div>
        <div className={s.desc}>https://motuojie.com</div>
        <div className={s.title}>twTitle</div>
        <div className={s.desc}>Motuojie - (摩界)</div>
        <div className={s.title}>twDescription</div>
        <div className={s.desc}>发现复古摩托车的魅力...</div>
        <div className={cn(s.bar, 'w-20 -bottom-2 left-12')} />
        <div className={cn(s.bar, '-bottom-5 opacity-15 left-12')} />
      </div>
    </div>
  )
}
