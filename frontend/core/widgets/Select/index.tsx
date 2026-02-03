// @
/*
 * this is a wrapper for [react-select](https://react-select.com/)
 * see detail props in https://react-select.com/props
 * Select
 *
 */

import { type FC, memo } from 'react'
import ReactSelect, { components } from 'react-select'
import CreatableReactSelect from 'react-select/creatable'

import { camelize } from '~/fmt'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import type { TSelectOption, TSpace } from '~/spec'

import useSalon, { cnMerge } from './salon'

type TProps = {
  testid?: string
  placeholder?: string
  options: TSelectOption[]
  className?: string
  creatable?: boolean

  isMulti?: boolean
  closeMenuOnSelect?: boolean
  isClearable?: boolean
  value?: TSelectOption | TSelectOption[] | null

  onChange?: (option: TSelectOption | TSelectOption[]) => void
  onCreateOption?: (newopt: string) => void
} & TSpace

const CustomOption = (props) => {
  const s = useSalon({ ...(props.selectProps?.spacing ?? {}) })
  const { label, icon } = props.data
  const Icon = icon || null
  const isActive = props.isSelected || props.isFocused

  return (
    <components.Option {...props}>
      <div className={s.optionRow}>
        {icon && <Icon className={s.icon} />}
        <span className={cnMerge(s.optionTitle, isActive && s.optionTitleActive)}>{label}</span>
      </div>
    </components.Option>
  )
}

const CustomSingleValue = (props) => {
  const s = useSalon({ ...(props.selectProps?.spacing ?? {}) })
  const { label, icon } = props.data
  const Icon = icon || null

  return (
    <components.SingleValue {...props}>
      <div className={s.optionRow}>
        {icon && <Icon className={s.valueIcon} />}
        <span>{label}</span>
      </div>
    </components.SingleValue>
  )
}

const Select: FC<TProps> = ({
  testid = 'widget-select',
  placeholder = '请选择..',
  options,
  isMulti = false,
  isClearable = false,
  closeMenuOnSelect = true,
  onChange = console.log,
  value = null,
  creatable = false,
  className = '',
  onCreateOption = console.log,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const primaryColor = usePrimaryColor()
  const primaryColorKey = camelize(primaryColor)
  const primary = `var(--color-rainbow-${primaryColorKey})`
  const optionActiveBg = 'var(--color-sandBox)'
  const optionActiveBorder = 'var(--color-digest)'
  const optionText = 'var(--color-digest)'
  const optionTextActive = 'var(--color-title)'

  const baseProps = {
    value,
    options,
    onChange,
    closeMenuOnSelect,
    placeholder,
    isClearable,
    spacing,
    classNames: {
      menu: (_) => s.menu,
      menuList: (_) => s.menuList,
      control: (_) => s.control,
      valueContainer: (_) => s.valueContainer,
      placeholder: (_) => s.placeholder,
      input: (_) => s.input,
      singleValue: (_) => s.singleValue,
      multiValue: (_) => s.multiValue,
      multiValueLabel: (_) => s.multiValueLabel,
      multiValueRemove: (_) => s.multiValueRemove,
      indicatorSeparator: (_) => s.indicatorSeparator,
      dropdownIndicator: (_) => s.dropdownIndicator,
      clearIndicator: (_) => s.clearIndicator,
      noOptionsMessage: (_) => s.noOptionsMessage,
      loadingMessage: (_) => s.loadingMessage,
      option: (state) => cnMerge(s.option, (state.isSelected || state.isFocused) && s.optionActive),
    },
    styles: {
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected || state.isFocused ? optionActiveBg : 'transparent',
        borderColor: state.isSelected || state.isFocused ? optionActiveBorder : 'transparent',
        borderStyle: 'solid',
        borderWidth: 1,
        color: state.isSelected || state.isFocused ? optionTextActive : optionText,
      }),
    },
    theme: (theme) => ({
      ...theme,
      borderRadius: 6,
      colors: {
        ...theme.colors,
        primary,
        primary25: optionActiveBg,
        primary50: optionActiveBg,
        neutral0: 'var(--color-card)',
        neutral5: 'var(--color-hoverBg)',
        neutral10: 'var(--color-hoverBg)',
        neutral20: 'var(--color-divider)',
        neutral30: 'var(--color-divider)',
        neutral40: 'var(--color-digest)',
        neutral50: 'var(--color-digest)',
        neutral60: 'var(--color-digest)',
        neutral70: 'var(--color-title)',
        neutral80: 'var(--color-digest)',
        neutral90: 'var(--color-title)',
      },
    }),
  }

  return (
    <div className={cnMerge(s.wrapper, className)}>
      {!creatable ? (
        <ReactSelect
          {...baseProps}
          isMulti={isMulti}
          components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
        />
      ) : (
        <CreatableReactSelect {...baseProps} onCreateOption={onCreateOption} />
      )}
    </div>
  )
}

export default memo(Select)
