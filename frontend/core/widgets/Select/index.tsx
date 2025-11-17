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

import type { TSelectOption, TSpace } from '~/spec'

import { IndicatorsContainer } from './components'

import useSalon, { cn } from './salon'

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
  const s = useSalon({ ...props.spacing })
  const { label, icon } = props.data
  const Icon = icon || null

  return (
    <components.Option {...props}>
      <div className='row'>
        {icon && <Icon className={s.icon} />}
        <span>{label}</span>
      </div>
    </components.Option>
  )
}

const CustomSingleValue = (props) => {
  const { label, icon } = props.data
  const Icon = icon || null

  return (
    <components.SingleValue {...props}>
      <div className='row'>
        <div className='-ml-1'>{icon && <Icon />}</div>
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

  const baseProps = {
    value,
    options,
    onChange,
    closeMenuOnSelect,
    placeholder,
    isClearable,
    components: { IndicatorsContainer },
    classNames: {
      menu: (_) => s.menu,
      menuList: (_) => s.menuList,
      control: (_) => s.control,
      option: (state) => cn(s.option, state.isSelected && s.optionActive),
    },
    theme: (theme) => ({
      ...theme,
      borderRadius: 2,
      colors: {
        ...theme.colors,
        primary: 'black',
      },
    }),
  }

  return (
    <div className={cn(s.wrapper, className)}>
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
