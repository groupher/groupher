/*
 *
 * ColorSelector
 *
 */

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'

import { COLOR, getDefaultCustomColor } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import BuildInColors from './BuildInColors'
import CustomColor from './CustomColor'
import CustomColorPicker from './CustomColorPicker'
import useSalon from './salon'

type TProps = {
  activeColor?: TColorName | string
  customColor?: string
  testid?: string
  children: ReactNode
  onChange?: (color: TColorName) => void
  onCustomColorChange?: (color: string) => void
  allowCustomColor?: boolean
  disabled?: boolean
  placement?: TTooltipPlacement
  offset?: [number, number]
  excepts?: TColorName[]
}

const DEFAULT_EXCEPTS: TColorName[] = []
const COLOR_VALUES = Object.values(COLOR) as string[]

const isCustomActiveColor = (activeColor?: TColorName | string): boolean => {
  if (!activeColor) return false
  if (activeColor === COLOR.CUSTOM) return true

  return !COLOR_VALUES.includes(activeColor)
}

const ColorSelector: FC<TProps> = ({
  testid = 'color-selector',
  activeColor,
  customColor,
  children,
  onChange = console.log,
  onCustomColorChange = console.log,
  allowCustomColor = false,
  disabled = false,
  placement = 'bottom',
  offset = [5, 5],
  excepts = DEFAULT_EXCEPTS,
}) => {
  const s = useSalon()
  const { theme } = useTheme()
  const defaultCustomColor = getDefaultCustomColor(theme)
  const [customExpanded, setCustomExpanded] = useState(false)
  const isCustomSelected = allowCustomColor && isCustomActiveColor(activeColor)

  useEffect(() => {
    if (!isCustomSelected) {
      setCustomExpanded(false)
    }
  }, [isCustomSelected])

  const mode = useMemo(() => {
    if (!allowCustomColor) return 'preset'
    if (customExpanded) return 'custom-expanded'
    if (isCustomSelected) return 'custom-collapsed'
    return 'preset'
  }, [allowCustomColor, customExpanded, isCustomSelected])

  const showCustomPicker = mode === 'custom-expanded'
  const stacked = showCustomPicker

  const ensureCustomColor = () => {
    if (!customColor) {
      onCustomColorChange(defaultCustomColor)
    }
  }

  const handleCustomClick = () => {
    ensureCustomColor()

    if (!isCustomSelected) {
      onChange(COLOR.CUSTOM)
    }

    setCustomExpanded(true)
  }

  const handlePresetClick = (color: TColorName) => {
    onChange(color)
    setCustomExpanded(false)
  }

  const handleCollapse = () => {
    setCustomExpanded(false)
  }

  if (disabled) return <span className='contents'>{children}</span>

  return (
    <Tooltip
      placement={placement}
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={offset}
      portalToBody
      onShow={() => setCustomExpanded(isCustomSelected)}
      onHide={() => setCustomExpanded(false)}
      content={
        <LazyMotion features={domAnimation}>
          <m.div
            layout
            transition={{ layout: { duration: 0.15, ease: 'easeInOut' } }}
            className={s.content}
            data-testid={testid}
          >
            <m.div
              layout
              transition={{ layout: { duration: 0.15, ease: 'easeInOut' } }}
              className={s.selectRow}
            >
              <m.div
                layout
                transition={{ layout: { duration: 0.15, ease: 'easeInOut' } }}
                className={s.buildInWrapper}
              >
                <BuildInColors
                  activeColor={showCustomPicker ? undefined : activeColor}
                  stacked={stacked}
                  onChange={handlePresetClick}
                  onCollapse={handleCollapse}
                  excepts={excepts}
                />
              </m.div>

              {allowCustomColor && (
                <m.div
                  layout
                  transition={{ layout: { duration: 0.15, ease: 'easeInOut' } }}
                  className={s.customWrapper}
                >
                  <CustomColor
                    color={customColor || defaultCustomColor}
                    selected={isCustomSelected}
                    expanded={showCustomPicker}
                    stacked={stacked}
                    onClick={handleCustomClick}
                  />
                </m.div>
              )}
            </m.div>

            <AnimatePresence initial={false}>
              {showCustomPicker && (
                <m.div
                  key='custom-picker'
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 6 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.15, ease: 'easeInOut' }}
                  className={s.customBlockMotion}
                >
                  <m.div
                    initial={{ y: -10, scale: 0.98 }}
                    animate={{ y: 0, scale: 1 }}
                    exit={{ y: -8, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className={s.customBlock}
                  >
                    <CustomColorPicker
                      color={customColor || defaultCustomColor}
                      onChange={onCustomColorChange}
                    />
                  </m.div>
                </m.div>
              )}
            </AnimatePresence>
          </m.div>
        </LazyMotion>
      }
    >
      {children}
    </Tooltip>
  )
}

export default ColorSelector
