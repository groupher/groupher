import Checker from '~/widgets/Checker'

import useSalon from './salon/rule_item'

type TProps = {
  ruleKey: string
  title?: string
  checked: boolean
  disabled: boolean
  primary?: boolean
  onChange: (checked: boolean) => void
}

export default function RuleItem({
  ruleKey,
  title,
  checked,
  disabled,
  primary = false,
  onChange,
}: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Checker
        checked={checked}
        disabled={disabled}
        size='small'
        aria-label={ruleKey}
        onChange={onChange}
      />
      <div className={primary ? s.primaryTitle : s.title} title={ruleKey}>
        {title || ruleKey}
      </div>
    </div>
  )
}
