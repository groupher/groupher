import { AnimatePresence, motion } from 'motion/react'
import type { ButtonHTMLAttributes } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string
}

type TPosition = {
  left: number
  top: number
}

export function ServiceActionButton({
  children,
  tooltip,
  onBlur,
  onClick,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  ...buttonProps
}: TProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<TPosition | null>(null)

  const closeTooltip = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = null
    setOpen(false)
  }

  const openTooltip = (delay: number) => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      setPosition({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 8,
      })
      setOpen(true)
      openTimerRef.current = null
    }, delay)
  }

  useEffect(
    () => () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
    },
    [],
  )

  return (
    <>
      <button
        ref={buttonRef}
        {...buttonProps}
        aria-describedby={open ? tooltipId : buttonProps['aria-describedby']}
        onBlur={(event) => {
          closeTooltip()
          onBlur?.(event)
        }}
        onClick={(event) => {
          closeTooltip()
          onClick?.(event)
        }}
        onFocus={(event) => {
          openTooltip(0)
          onFocus?.(event)
        }}
        onMouseEnter={(event) => {
          openTooltip(350)
          onMouseEnter?.(event)
        }}
        onMouseLeave={(event) => {
          closeTooltip()
          onMouseLeave?.(event)
        }}
      >
        {children}
      </button>
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence initial={false}>
              {open && position ? (
                <motion.div
                  id={tooltipId}
                  className='service-action-tooltip'
                  role='tooltip'
                  style={position}
                  initial={{ opacity: 0, scale: 0.98, y: -2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -1 }}
                  transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
                >
                  {tooltip}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  )
}
