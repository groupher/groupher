'use client'

/*
 * Tooltip
 * use custom animation Globally at GlobalStyle.ts
 */

import Tippy from '@groupher/tooltip'
import { type FC, memo, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Instance } from 'tippy.js'
import { hideAll } from 'tippy.js'
import THEME from '~/const/theme'
import useOverlayDark from '~/hooks/useOverlayDark'
import useOutsideClick from '~/hooks/useOutsideClick'
import useTheme from '~/hooks/useTheme'
import type { TThemeName, TTooltipPlacement } from '~/spec'

import ConfirmFooter from './ConfirmFooter'
import { FOOTER_BEHAVIOR } from './constant'
import useSalon, { cnMerge } from './salon'

/**
 * Current tooltip theme.
 * For now it's hard-coded.
 */
export type TProps = {
  children: ReactNode
  content: string | ReactNode
  maxWidth?: number | string
  placement?: TTooltipPlacement
  delay?: number
  offset?: [number, number]
  duration?: number
  trigger?: 'mouseenter focus' | 'click'
  hideOnClick?: boolean
  noPadding?: boolean
  behavior?: 'default' | 'confirm' | 'delete-confirm' | 'add'
  forceZIndex?: boolean
  interactive?: boolean
  visible?: boolean | null
  onShow?: () => void
  onHide?: () => void
  onConfirm?: () => void
}

/**
 * Minimal props for our React Tippy wrapper.
 * IMPORTANT: Do NOT use `tippy.js` Props here — it’s DOM content typed, not ReactNode.
 */
type TTippyReactProps = {
  ref: React.RefObject<HTMLDivElement>
  content: ReactNode
  maxWidth?: number | string
  placement?: TTooltipPlacement
  hideOnClick?: boolean
  zIndex?: number
  delay?: [number, number]
  offset?: [number, number]
  duration?: number
  trigger?: string
  interactive?: boolean
  theme?: TThemeName
  visible?: boolean

  onHide?: () => void
  onShow?: (instance: Instance) => void
}

const Tooltip: FC<TProps> = ({
  children,
  noPadding = false,
  interactive = true,
  onHide,
  onShow,
  maxWidth,
  placement = 'top',
  delay = 0,
  offset = [5, 5],
  duration = 0,
  content,
  hideOnClick = true,
  behavior = 'default',
  trigger = 'mouseenter focus',
  visible = null,
  onConfirm,
  forceZIndex = false,
}) => {
  const s = useSalon()
  const overlayDark = useOverlayDark()

  const { theme } = useTheme()
  const tooltipTheme = overlayDark ? THEME.DARK : theme

  const instanceRef = useRef<Instance | null>(null)
  const [active, setActive] = useState(false)

  // trigger wrapper ref (reference element)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  // popover content root ref (portal content)
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Close when clicking outside both trigger and popover content.
  useOutsideClick([triggerRef, contentRef], () => {
    instanceRef.current?.hide()
  })

  // Theme switch / route transition safety: destroy transient UI to avoid flicker/residual popper.
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.destroy()
      instanceRef.current = null
      setActive(false)
    }
  }, [theme, overlayDark, tooltipTheme])

  // Unmount cleanup
  useEffect(() => {
    return () => {
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Position refresh intentionally tracks rendered tooltip state/content only; instanceRef/contentRef mutations do not participate in React's dependency model.
  useEffect(() => {
    if (!active || !contentRef.current) return

    const updatePosition = () => {
      instanceRef.current?.popperInstance?.update()
    }

    updatePosition()

    const observer = new ResizeObserver(() => {
      updatePosition()
    })

    observer.observe(contentRef.current)

    return () => observer.disconnect()
  }, [active, content])

  const PopoverContent = useMemo(
    () => (
      <div
        role='presentation'
        className={s.content}
        aria-hidden='true'
        ref={contentRef}
        onClick={() => {
          if (hideOnClick) instanceRef.current?.hide()
        }}
      >
        {content}
        {active && behavior !== FOOTER_BEHAVIOR.DEFAULT && (
          <ConfirmFooter
            onConfirm={() => {
              onConfirm?.()
              instanceRef.current?.hide()
            }}
            onCancel={() => instanceRef.current?.hide()}
            behavior={behavior}
          />
        )}
      </div>
    ),
    [s.content, hideOnClick, content, active, behavior, onConfirm],
  )

  const tippyProps: TTippyReactProps = useMemo(() => {
    const props: TTippyReactProps = {
      ref: triggerRef as React.RefObject<HTMLDivElement>, // triggerRef is compatible (nullable current)
      content: PopoverContent,
      maxWidth,
      placement,
      hideOnClick,
      zIndex: 3000,
      delay: [delay, 0],
      offset,
      duration,
      trigger,
      interactive,

      // Let tippy manage `.tippy-box[data-theme=...]` (stable)
      theme: tooltipTheme,

      onHide: () => {
        instanceRef.current = null
        setActive(false)
        onHide?.()
      },

      onShow: (ins) => {
        // avoid fighting controlled tooltips
        if (visible === null) hideAll({ exclude: ins })

        const tippyBox = ins.popper.querySelector('.tippy-box')
        if (tippyBox) {
          tippyBox.setAttribute('data-overlay-dark', String(overlayDark))
          tippyBox.setAttribute('data-page-theme', theme)
        }

        instanceRef.current = ins
        setActive(true)
        onShow?.()
      },
    }

    if (visible !== null) props.visible = visible
    return props
  }, [
    PopoverContent,
    maxWidth,
    placement,
    hideOnClick,
    delay,
    offset,
    duration,
    trigger,
    interactive,
    theme,
    overlayDark,
    tooltipTheme,
    visible,
    onHide,
    onShow,
  ])

  const wrapperClass = !noPadding ? s.tooltip : cnMerge(s.tooltip, 'p-0')

  /**
   * forceZIndex: only used in some special masking scenarios (IconSwitcher)
   * Put z-1 on the trigger wrapper, not on the popper.
   */
  const triggerWrapperClass = forceZIndex ? 'relative z-10' : undefined

  return (
    <Tippy className={wrapperClass} {...tippyProps}>
      <div className={triggerWrapperClass}>{children}</div>
    </Tippy>
  )
}

export default memo(Tooltip)
