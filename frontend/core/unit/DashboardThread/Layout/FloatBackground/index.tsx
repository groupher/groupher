import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useOverlayDark from '../../logic/useOverlayDark'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from './salon'

function PanelContent({ dark = false }: { dark?: boolean }) {
  const s = useSalon()
  const tone = dark ? 'bg-white' : undefined

  return (
    <>
      <div className={cnMerge(s.bar, s.panelTitle, tone)} />
      <div className={cnMerge(s.bar, s.panelShort, tone)} />
      <div className={cnMerge(s.bar, s.panelWide, tone)} />
      <div className={cnMerge(s.bar, s.panelMid, tone)} />
      <div className={cnMerge(s.bar, s.panelNarrow, tone)} />
      <div className={cnMerge(s.bar, s.panelWideDim, tone)} />
      <div className={cnMerge(s.bar, s.panelWideDim, tone)} />
    </>
  )
}

function PopoverContent({ dark = false }: { dark?: boolean }) {
  const s = useSalon()
  const tone = dark ? 'bg-white' : 'bg-black'

  return (
    <div className={s.popoverBody}>
      <div className={cnMerge(s.bar, s.popoverTitle, tone)} />
      <div className={cnMerge(s.bar, s.popoverBodyWide, tone)} />
      <div className={cnMerge(s.bar, s.popoverBodyNarrow, tone)} />
    </div>
  )
}

export default function FloatBackground() {
  const s = useSalon()
  const { overlayDark, edit, isTouched } = useOverlayDark()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.float_background.title')}
        desc={t('dsb.layout.float_background.desc')}
      />

      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={overlayDark}
          onClick={() => edit(true, FIELD.OVERLAY_DARK)}
        >
          <div className={cnMerge(s.block, overlayDark && s.blockActive)}>
            <div
              className={cnMerge(s.popover, 'left-20 top-12')}
              style={{ borderColor: 'dimgray' }}
            >
              <PopoverContent dark />
            </div>
            <div className={cnMerge(s.panel, s.lightPanel)}>
              <PanelContent />
            </div>
            <div className={cnMerge(s.panel, s.darkPanel)}>
              <PanelContent dark />
            </div>
          </div>

          <CheckLabel
            title={t('dsb.layout.float_background.option.dark')}
            active={overlayDark}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={!overlayDark}
          onClick={() => edit(false, FIELD.OVERLAY_DARK)}
        >
          <div className={cnMerge(s.block, !overlayDark && s.blockActive)}>
            <div
              className={cnMerge(s.popover, 'left-5 top-12 w-24 bg-white')}
              style={{ borderColor: 'dimgray' }}
            >
              <PopoverContent />
            </div>

            <div
              className={cnMerge(s.popover, 'right-5 top-12 w-24')}
              style={{ borderColor: 'dimgray' }}
            >
              <PopoverContent dark />
            </div>

            <div className={cnMerge(s.panel, s.lightPanel)}>
              <PanelContent />
            </div>
            <div className={cnMerge(s.panel, s.darkPanel)}>
              <PanelContent dark />
            </div>
          </div>

          <CheckLabel
            title={t('dsb.layout.float_background.option.follow')}
            active={!overlayDark}
            top={4}
          />
        </button>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.OVERLAY_DARK} top={6} />
    </section>
  )
}
