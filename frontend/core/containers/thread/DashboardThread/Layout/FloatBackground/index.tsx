import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'
import { FIELD } from '../../constant'
import useDarkFloat from '../../logic/useDarkFloat'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/float_background'

export default function FloatBackground() {
  const s = useSalon()
  const { darkFloat, edit, isTouched, saving } = useDarkFloat()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.float_background.title')}
        desc={t('dsb.layout.float_background.desc')}
      />

      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(true, FIELD.DARK_FLOAT)}>
          <div className={cnMerge(s.block, darkFloat && s.blockActive)}>
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

          <CheckLabel
            title={t('dsb.layout.float_background.option.dark')}
            active={darkFloat}
            top={4}
          />
        </button>
        <button className={s.layout} onClick={() => edit(false, FIELD.DARK_FLOAT)}>
          <div className={cnMerge(s.block, !darkFloat && s.blockActive)}>
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

          <CheckLabel
            title={t('dsb.layout.float_background.option.follow')}
            active={!darkFloat}
            top={4}
          />
        </button>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.DARK_FLOAT} loading={saving} top={6} />
    </section>
  )
}
