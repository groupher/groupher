import { titleCaseHM, upperSnakeCase } from '~/fmt'
import useTheme from '~/hooks/useTheme'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import { SETTING_FIELD } from '../constant'
import usePageBg from '../logic/usePageBg'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn } from '../salon/layout/page_background'

export default () => {
  const { rawBg, edit, isTouched, isDarkTouched, saving } = usePageBg()

  const s = useSalon()
  const { isLightTheme } = useTheme()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title='页面背景色'
        desc={
          <div className='row'>
            设置主页面背景色。参考
            <ArrowButton left={1}>影响范围</ArrowButton>
          </div>
        }
        classNames='pr-8'
        withThemeSelect
      />

      <div className={s.themeGroup}>
        {s.bgColors.map((bg, index) => {
          const bgTitle = titleCaseHM(bg)
          const currentBg = s.bgColorsObj[bg]
          const active = rawBg === currentBg

          return (
            <button
              key={bg}
              className={cn(s.block, `rotate-${s.rotateAngle[index]}`, active && s.blockActive)}
              style={{ backgroundColor: currentBg }}
              onClick={() => {
                edit(upperSnakeCase(bg), isLightTheme ? 'pageBg' : 'pageBgDark')
              }}
            >
              {!active && <div className={s.titleHint}>{bgTitle}</div>}
              {active && <div className={s.colorTitle}>{bgTitle}</div>}
              {active && <div className={s.hex}>{currentBg}</div>}
            </button>
          )
        })}
      </div>

      {isLightTheme ? (
        <SavingBar
          isTouched={isTouched}
          field={SETTING_FIELD.PAGE_BG}
          loading={saving}
          top={10}
          left={1}
          width='w-11/12'
        />
      ) : (
        <SavingBar
          isTouched={isDarkTouched}
          field={SETTING_FIELD.PAGE_BG_DARK}
          loading={saving}
          top={10}
          left={1}
          width='w-11/12'
        />
      )}
    </section>
  )
}
