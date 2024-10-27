import Img from '~/Img'

import useSalon, { cn } from '../../styles/dashboard_intros/import_tab/content'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.head}>
        <Img src="groupher.png" className={s.logo} />
        <div className={s.title}>Groupher</div>
      </div>

      <div className={cn(s.bar, 'mt-3.5')} />
      <div className={cn(s.bar, 'w-28')} />
      <div className={cn(s.bar, 'w-32 opacity-15')} />
      <div className={cn(s.bar, 'w-20 opacity-10')} />
      <div className={cn(s.bar, 'opacity-5')} />
    </div>
  )
}
