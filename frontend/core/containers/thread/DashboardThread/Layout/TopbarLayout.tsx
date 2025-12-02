import { DSB_DESC_LAYOUT, TOPBAR_LAYOUT } from '~/const/layout'
import { callDashboardDesc } from '~/signal'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import CheckLabel from '~/widgets/CheckLabel'
import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../constant'
import useTopbar from '../logic/useTopbar'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn } from '../salon/layout/topbar_layout'

export default () => {
  const s = useSalon()

  const { edit, layout, isBgTouched, isLayoutTouched, saving, bg } = useTopbar()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title='Topbar 样式'
        desc={
          <>
            全局 Topbar 的样式。
            <div className='inline-block'>
              <ArrowButton
                onClick={() => callDashboardDesc(DSB_DESC_LAYOUT.POST_LIST)}
                fontSize={12}
              >
                查看示例
              </ArrowButton>
            </div>
          </>
        }
      />
      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(TOPBAR_LAYOUT.YES, 'topbarLayout')}>
          <div className={cn(s.block, layout === TOPBAR_LAYOUT.YES && s.blockActive)}>
            <div className={s.topBar} />
            <div className={cn(s.bar, 'top-8 left-5 h-28 w-6/12 opacity-5')} />
            <div className={cn(s.bar, 'top-8 right-5 h-24 w-20 opacity-5')} />
          </div>
          <CheckLabel title='有 Topbar' active={layout === TOPBAR_LAYOUT.YES} top={4} />
        </button>
        <button className={s.layout} onClick={() => edit(TOPBAR_LAYOUT.NO, 'topbarLayout')}>
          <div className={cn(s.block, layout === TOPBAR_LAYOUT.NO && s.blockActive)}>
            <div className={cn(s.bar, 'top-8 left-5 h-28 w-6/12 opacity-5')} />
            <div className={cn(s.bar, 'top-8 right-5 h-24 w-20 opacity-5')} />
          </div>
          <CheckLabel title='无 Topbar' active={layout === TOPBAR_LAYOUT.NO} top={4} />
        </button>
      </div>

      <SavingBar
        isTouched={isLayoutTouched}
        field={FIELD.TOPBAR_LAYOUT}
        loading={saving}
        top={10}
      />

      <div className='mt-8' />
      {layout === TOPBAR_LAYOUT.YES && (
        <SavingBar
          isTouched={isBgTouched}
          field={FIELD.TOPBAR_BG}
          loading={saving}
          left={-10}
          top={30}
          width='89%'
        >
          <div className={s.bgWrapper}>
            <div>颜色:</div>
            <div className={s.bgLabel}>
              <ColorSelector
                activeColor={bg}
                onChange={(color) => edit(color, 'topbarBg')}
                placement='right'
                offset={[-1, 15]}
              >
                <div className={s.theColor} />
              </ColorSelector>
            </div>
          </div>
        </SavingBar>
      )}
    </div>
  )
}
