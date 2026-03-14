import { includes, keys } from 'ramda'

import CheckSVG from '~/icons/Check'
import RootCheckSVG from '~/icons/CheckCircle'
import Checker from '~/widgets/Checker'
import useSalon from './salon/selects'
import useLogic from './useLogic'

export default function Selects() {
  const s = useSalon()

  const { rules, allModeratorRules, selectedRules, isReadonly, toggleCheck } = useLogic()

  const optionsJson = JSON.parse(rules)
  const optionKeys = keys(optionsJson)

  if (isReadonly) {
    const moderatorKeys = keys(JSON.parse(allModeratorRules))

    return (
      <div className={s.wrapper}>
        {optionKeys.map((ruleKey: string) => {
          const isRootRule = !includes(ruleKey, moderatorKeys)

          return (
            <div className={s.readonlyItem} key={ruleKey}>
              {isRootRule ? (
                <RootCheckSVG className={s.rootCheckIcon} />
              ) : (
                <CheckSVG className={s.checkIcon} />
              )}

              <div className={s.itemTitle}>{ruleKey}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      {optionKeys.map((ruleKey: string) => {
        return (
          <div className={s.item} key={ruleKey}>
            <Checker
              checked={includes(ruleKey, selectedRules)}
              size='small'
              onChange={(checked) => toggleCheck(ruleKey, checked)}
            >
              <div className={s.itemTitle}>{ruleKey}</div>
            </Checker>
          </div>
        )
      })}
    </div>
  )
}
