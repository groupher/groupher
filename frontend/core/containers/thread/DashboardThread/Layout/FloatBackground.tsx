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
            <div
              className={cnMerge(s.popover, 'left-20 top-12')}
              style={{ borderColor: 'dimgray' }}
            >
              <div className={cnMerge(s.bar, 'top-4 left-5 w-20 opacity-30 bg-white')} />
              <div className={cnMerge(s.bar, 'top-8 left-5 w-14 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-12 left-5 w-12 opacity-20 bg-white')} />
            </div>
            <div className={s.lightPanel}>
              <div className={cnMerge(s.bar, 'h-2.5 top-5 left-5 ml-0.5 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-10 left-5 w-12 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-16 left-5 w-20 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-24 left-5 w-16 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-28 left-5 w-20 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-32 left-5 w-20 opacity-10')} />
              <div className={cnMerge(s.bar, 'top-36 left-5 w-20 opacity-10')} />
            </div>
            <div className={s.darkPanel}>
              <div className={cnMerge(s.bar, 'h-2.5 top-5 right-5 ml-0.5 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-10 right-5 w-12 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-16 right-5 w-20 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-24 right-5 w-14 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-28 right-5 w-12 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-32 right-5 w-20 opacity-10 bg-white')} />
              <div className={cnMerge(s.bar, 'top-36 right-5 w-20 opacity-10 bg-white')} />
            </div>
          </div>

          <CheckLabel title='始终使用深色' active top={4} />
        </button>
        <button className={s.layout}>
          <div className={cnMerge(s.block)}>
            <div
              className={cnMerge(s.popover, 'left-5 top-12 w-24 bg-white')}
              style={{ borderColor: 'dimgray' }}
            >
              <div className={cnMerge(s.bar, 'top-4 left-5 w-14 opacity-30 bg-black')} />
              <div className={cnMerge(s.bar, 'top-8 left-5 w-12 opacity-20 bg-black')} />
              <div className={cnMerge(s.bar, 'top-12 left-5 w-8 opacity-20 bg-black')} />
            </div>

            <div
              className={cnMerge(s.popover, 'right-5 top-12 w-24')}
              style={{ borderColor: 'dimgray' }}
            >
              <div className={cnMerge(s.bar, 'top-4 left-5 w-14 opacity-30 bg-white')} />
              <div className={cnMerge(s.bar, 'top-8 left-5 w-12 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-12 left-5 w-8 opacity-20 bg-white')} />
            </div>

            <div className={s.lightPanel}>
              <div className={cnMerge(s.bar, 'h-2.5 top-5 left-5 ml-0.5 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-10 left-5 w-12 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-16 left-5 w-20 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-24 left-5 w-16 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-28 left-5 w-20 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-32 left-5 w-20 opacity-10')} />
              <div className={cnMerge(s.bar, 'top-36 left-5 w-20 opacity-10')} />
            </div>
            <div className={s.darkPanel}>
              <div className={cnMerge(s.bar, 'h-2.5 top-5 right-5 ml-0.5 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-10 right-5 w-12 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-16 right-5 w-20 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-24 right-5 w-14 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-28 right-5 w-12 opacity-20 bg-white')} />
              <div className={cnMerge(s.bar, 'top-32 right-5 w-20 opacity-10 bg-white')} />
              <div className={cnMerge(s.bar, 'top-36 right-5 w-20 opacity-10 bg-white')} />
            </div>
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
