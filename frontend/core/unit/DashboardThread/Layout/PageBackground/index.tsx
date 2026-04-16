import { getCSSVar } from '~/css'
import { camelize, titleCaseHM, upperSnakeCase } from '~/fmt'
import useDidMount from '~/hooks/useDidMount'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/Check'
import { FIELD } from '../../constant'
import usePageBg from '../../logic/usePageBg'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/page_background'

export default function PageBackground() {
  const { rawBg, edit, isTouched, isDarkTouched, saving } = usePageBg()

  const mounted = useDidMount()

  const s = useSalon()
  const { isLightTheme } = useTheme()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.page_background.title')}
        desc={t('dsb.layout.page_background.desc')}
        withThemeSelect
      />

      <div className={s.themeGroup}>
        {mounted &&
          s.bgColorNames.map((bg, index) => {
            const bgTitle = titleCaseHM(bg)
            const pageName = camelize(bg)
            const bgVal = getCSSVar(`color-page-${pageName}`)
            const active = rawBg === bgVal && !!rawBg

            return (
              <button
                key={bg}
                type='button'
                className={cn(s.block, `rotate-${s.rotateAngle[index]}`, active && s.blockActive)}
                aria-pressed={active}
                onClick={() => {
                  edit(upperSnakeCase(bg), isLightTheme ? FIELD.PAGE_BG : FIELD.PAGE_BG_DARK)
                }}
              >
                <div className={cn(s.blockInner, s.getPageClass(pageName))}>
                  {active && <CheckSVG className={s.checker} />}
                </div>
                <div className={s.footer}>
                  <div className={s.colorTitle}>{bgTitle}</div>
                  <div className={s.hex}>{bgVal}</div>
                </div>
              </button>
            )
          })}
      </div>

      {isLightTheme ? (
        <SavingBar isTouched={isTouched} field={FIELD.PAGE_BG} loading={saving} top={10} left={1} />
      ) : (
        <SavingBar
          isTouched={isDarkTouched}
          field={FIELD.PAGE_BG_DARK}
          loading={saving}
          top={10}
          left={1}
        />
      )}
    </section>
  )
}
