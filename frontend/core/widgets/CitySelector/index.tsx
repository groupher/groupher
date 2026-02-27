/*
 *
 * CitySelector
 *
 */

import { type FC, memo, useCallback, useMemo, useState } from 'react'
import { find, includes, without, reject, isEmpty } from 'ramda'

import type { TCityOption, TSpace } from '~/spec'
import { CITY_OPTIONS, HOME_CITY_OPTIONS, CITY_OPTION_VALUES } from '~/const/city'

import Input from '~/widgets/Input'

import useSalon, { cn, FLAGS } from './salon'

type TProps = {
  value?: string
  onChange?: (value: string) => void
} & TSpace

const CitySelector: FC<TProps> = ({ value = '', onChange = console.log, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const parsed = useMemo(() => {
    const splitted = reject(isEmpty, value.split(','))
    const selectedCities: string[] = []
    const extraCityItems: string[] = []

    for (const item of splitted) {
      if (includes(item, CITY_OPTION_VALUES)) {
        selectedCities.push(item)
      } else {
        extraCityItems.push(item)
      }
    }

    return {
      selectedCities,
      extraCities: extraCityItems.join(','),
    }
  }, [value])

  const [showMore, setShowMore] = useState(false)
  const [extraCitiesDraft, setExtraCitiesDraft] = useState('')
  const selected = parsed.selectedCities
  const extraCities = extraCitiesDraft || parsed.extraCities
  const showMorePanel = showMore || !isEmpty(parsed.extraCities)
  const options = showMorePanel ? CITY_OPTIONS : HOME_CITY_OPTIONS

  const calcCityValue = useCallback((extraCityValue: string, selectedCityValue: string) => {
    return extraCityValue.trim()
      ? `${selectedCityValue},${extraCityValue.replaceAll('，', ',')}`
      : selectedCityValue
  }, [])

  const cityOnChange = (option) => {
    let selectedAfter = []
    if (!find((item) => item === option.value, selected)) {
      selectedAfter = [...selected, option.value]
    } else {
      selectedAfter = without([option.value], selected)
    }

    const selectedCityValue = reject(isEmpty, selectedAfter).join(',')
    const cityVal = calcCityValue(extraCities, selectedCityValue)

    onChange(reject(isEmpty, cityVal.split(',')).join(','))
  }

  const extraCityOnBlur = () => {
    const selectedCityValue = reject(isEmpty, selected).join(',')
    const cityVal = calcCityValue(extraCities, selectedCityValue)

    onChange(reject(isEmpty, cityVal.split(',')).join(','))
  }

  return (
    <div className={s.wrapper}>
      {options.map((option: TCityOption) => {
        const NationFlag = FLAGS[option.flag] || null

        const active = includes(option.value, selected)

        return (
          <button
            type='button'
            className={cn(s.box, active && s.boxActive, option.flag && 'px-2.5')}
            key={option.value}
            onClick={() => cityOnChange(option)}
          >
            {option.label}
            {NationFlag && <NationFlag className={cn(s.flag, !active && 'opacity-65')} />}
          </button>
        )
      })}
      {!showMorePanel && (
        <button type='button' className={s.moreBtn} onClick={() => setShowMore(true)}>
          更多..
        </button>
      )}
      {showMorePanel && (
        <>
          <div className={s.inputLabel}>其他城市（地区）：</div>
          <Input
            placeholder="多个城市请用 , 分隔开"
            value={extraCities}
            onChange={(e) => setExtraCitiesDraft(e.target.value)}
            onBlur={() => extraCityOnBlur()}
          />
        </>
      )}
    </div>
  )
}

export default memo(CitySelector)
