import { keys, includes } from 'ramda'

import { Trans } from '~/i18n/dashboard'

import RootCheckSVG from '~/icons/CheckCircle'
import CheckSVG from '~/icons/Check'
import Checker from '~/widgets/Checker'

import useLogic from './useLogic'
import useSalon from './salon/selects'

export default () => {
  const s = useSalon()

  const { getRules, allModeratorRules, selectedRules, getIsReadonly, toggleCheck } = useLogic()
  const rules = getRules()

  const optionsJson = JSON.parse(rules)
  const optionKeys = keys(optionsJson)

  const readonly = getIsReadonly()

  if (readonly) {
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

              <div className={s.itemTitle}>{Trans(ruleKey)}</div>
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
              size="small"
              onChange={(checked) => toggleCheck(ruleKey, checked)}
            >
              <div className={s.itemTitle}>{Trans(ruleKey)}</div>
            </Checker>
          </div>
        )
      })}
    </div>
  )
}
