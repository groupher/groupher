import { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/Check'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

export default function Appearance() {
  const dsb$ = useDashboard()
  const { edit } = useHelper()
  const { t } = useTrans()

  const activePreset = dsb$.themePreset
  const isTouched = activePreset !== dsb$.original.themePreset

  return (
    <section>
      <SectionLabel
        title={t('dsb.layout.appearance.title')}
        desc={t('dsb.layout.appearance.desc')}
      />

      <div className='mt-8 grid grid-cols-2 gap-4'>
        {THEME_PRESET_OPTIONS.map((preset) => {
          const active = preset.value === activePreset

          return (
            <button
              key={preset.value}
              type='button'
              aria-pressed={active}
              className={cn(
                'relative min-h-36 rounded-lg border p-4 text-left transition-colors',
                active
                  ? 'border-link bg-alphaBg'
                  : 'border-divider bg-card hover:border-link hover:bg-hoverBg',
              )}
              onClick={() => edit(preset.value, FIELD.THEME_PRESET)}
            >
              <div className='mb-5 flex items-center gap-2'>
                <span className='h-4 w-10 rounded-full bg-[#2f3440]' />
                <span className='h-4 w-8 rounded-full bg-[#c97945]' />
                <span className='h-4 w-6 rounded-full bg-[#70a9b6]' />
              </div>

              <div className='space-y-2'>
                <div className='text-fg text-base font-medium'>{preset.title}</div>
                <div className='text-digest text-sm'>{preset.desc}</div>
              </div>

              {active && (
                <div className='bg-link absolute top-3 right-3 rounded-full p-1 text-white'>
                  <CheckSVG className='size-3' />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <SavingBar field={FIELD.THEME_PRESET} isTouched={isTouched} top={8} />
    </section>
  )
}
