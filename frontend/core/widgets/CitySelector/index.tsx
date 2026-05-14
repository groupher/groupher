/*
 *
 * CitySelector
 *
 */

import { find, includes, isEmpty, reject, without } from 'ramda'
import { type FC, memo, useCallback, useState } from 'react'

import { CITY_OPTION_VALUES, CITY_OPTIONS, HOME_CITY_OPTIONS } from '~/const/city'
import type { TCityOption, TSpace } from '~/spec'
import Input from '~/widgets/Input'

import useSalon, { cn, FLAGS } from './salon'

type TProps = {
  value?: string
  onChange?: (value: string) => void
} & TSpace

type TCityState = {
  selected: string[]
  showMore: boolean
  extraCities: string
}

const parseCityState = (value: string): TCityState => {
  const selected: string[] = []
  const extraCities: string[] = []

  for (const item of value.split(',')) {
    if (!includes(item, CITY_OPTION_VALUES)) {
      extraCities.push(item)
    } else {
      selected.push(item)
    }
  }

  const validExtraCities = reject(isEmpty, extraCities)

  return {
    selected,
    showMore: validExtraCities.length > 0,
    extraCities: validExtraCities.join(','),
  }
}

const CitySelectorContent: FC<TProps> = ({ value = '', onChange = console.log, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const [cityState, setCityState] = useState<TCityState>(() => parseCityState(value))

  const { selected, showMore, extraCities } = cityState
  const options = !showMore ? HOME_CITY_OPTIONS : CITY_OPTIONS

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

    setCityState((prev) => ({ ...prev, selected: selectedAfter }))

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
      {!showMore && (
        <button
          type='button'
          className={s.moreBtn}
          onClick={() => setCityState((prev) => ({ ...prev, showMore: true }))}
        >
          更多..
        </button>
      )}
      {showMore && (
        <>
          <div className={s.inputLabel}>其他城市（地区）：</div>
          <Input
            placeholder='多个城市请用 , 分隔开'
            value={extraCities}
            onChange={(e) => setCityState((prev) => ({ ...prev, extraCities: e.target.value }))}
            onBlur={() => extraCityOnBlur()}
          />
        </>
      )}
    </div>
  )
}

const CitySelector: FC<TProps> = ({ value = '', ...props }) => {
  return <CitySelectorContent key={value} value={value} {...props} />
}

export default memo(CitySelector)
