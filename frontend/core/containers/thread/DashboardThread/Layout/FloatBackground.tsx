import CheckLabel from '~/widgets/CheckLabel'
import { FIELD } from '../constant'
import usePrimaryColor from '../logic/usePrimaryColor'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cnMerge } from '../salon/layout/float_background'

export default () => {
  const s = useSalon()
  const { isTouched, saving } = usePrimaryColor()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title='弹出层外观'
        desc='浅色主题下使用深色弹出层, 仅作用于 Tooltip/Menu/Popover 等轻量弹出层，不影响 Modal/Drawer 等容器组件。参考'
      />
      <div className={s.select}>
        <button className={s.layout}>
          <div className={cnMerge(s.block, s.blockActive)}>
            <div className={cnMerge(s.cover, 'left-16')} />
            <div className={cnMerge(s.bar, 'h-2.5 top-28 left-16 ml-0.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-32 left-16 ml-0.5 mt-2 w-32 opacity-20')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-36 left-16 ml-0.5 mt-2 w-28 opacity-10')} />
          </div>

          <CheckLabel title='始终使用深色' active top={4} />
        </button>
        <button className={s.layout}>
          <div className={cnMerge(s.block)}>
            <div className={cnMerge(s.cover, 'left-16')} />
            <div className={cnMerge(s.bar, 'h-2.5 top-28 left-16 ml-0.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-32 left-16 ml-0.5 mt-2 w-32 opacity-20')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-36 left-16 ml-0.5 mt-2 w-28 opacity-10')} />
          </div>

          <CheckLabel title='跟随主题' top={4} />
        </button>
      </div>

      <SavingBar
        isTouched={isTouched}
        field={FIELD.PRIMARY_COLOR}
        loading={saving}
        width='w-11/12'
        top={6}
      />
    </section>
  )
}
