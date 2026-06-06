import { IMAGE_RATIO } from '../../../../constant'
import type { TImageRadio } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon, { cn } from './salon'

type TProps = {
  ratio: TImageRadio
}

const OPTIONS: Array<{ label: string; value: TImageRadio; className: string }> = [
  { label: '16:9', value: IMAGE_RATIO.SCREEN, className: 'w-16' },
  { label: '4:3', value: IMAGE_RATIO.TV, className: 'w-12' },
  { label: '1:1', value: IMAGE_RATIO.SQUARE, className: 'w-9' },
]

export default function Ratio({ ratio }: TProps) {
  const s = useSalon()
  const { ratioOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Ratio'>
        <div className={s.optionRow}>
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type='button'
              className={cn(
                s.optionItem,
                option.className,
                ratio === option.value && s.optionItemActive,
              )}
              aria-label={option.label}
              onClick={() => ratioOnChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </GroupItem>
    </section>
  )
}
