/*
 *
 * CitySelector
 *
 */

import { type FC, memo, useCallback, useEffect, useState } from 'react'
import { find, includes, without, reject, isEmpty, forEach } from 'ramda'

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

  const [selected, setSelected] = useState(value.split(','))
  const [showMore, setShowMore] = useState(false)
  const [extraCities, setExtraCities] = useState('')

  useEffect(() => {
    const splitedValue = value.split(',')
    const extraCities = []
    const selectedCities = []

    forEach((item) => {
      if (!includes(item, CITY_OPTION_VALUES)) {
        extraCities.push(item)
      } else {
        selectedCities.push(item)
      }
    }, splitedValue)

    setSelected(selectedCities)

    if (!(isEmpty(extraCities) || reject(isEmpty, extraCities).length === 0)) {
      setExtraCities(extraCities.join(','))
      setShowMore(true)
    }
  }, [value])

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

    setSelected(selectedAfter)

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
          <div
            className={cn(s.box, active && s.boxActive, option.flag && 'px-2.5')}
            key={option.value}
            onClick={() => cityOnChange(option)}
          >
            {option.label}
            {NationFlag && <NationFlag className={cn(s.flag, !active && 'opacity-65')} />}
          </div>
        )
      })}
      {!showMore && (
        <div className={s.moreBtn} onClick={() => setShowMore(true)}>
          更多..
        </div>
      )}
      {showMore && (
        <>
          <div className={s.inputLabel}>其他城市（地区）：</div>
          <Input
            placeholder="多个城市请用 , 分隔开"
            value={extraCities}
            onChange={(e) => setExtraCities(e.target.value)}
            onBlur={() => extraCityOnBlur()}
          />
        </>
      )}
    </div>
  )
}

export default memo(CitySelector)
