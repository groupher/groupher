import { type FC, useCallback, useEffect, useRef } from 'react'

import { lockPage, toggleGlobalBlur, unlockPage } from '~/dom'
import useShortcut from '~/hooks/useShortcut'
import useTheme from '~/hooks/useTheme'
import useTopGlow from '~/hooks/useTopGlow'
import CloseCrossSVG from '~/icons/CloseLight'
import Portal from '~/widgets/Portal'
import ViewportTracker from '~/widgets/ViewportTracker'

import type { TProps as BaseTProps } from '.'
import useSalon, { cn } from './salon'

type TProps = Pick<
  BaseTProps,
  'children' | 'show' | 'width' | 'showCloseBtn' | 'mode' | 'offsetTop' | 'offsetLeft' | 'compact'
> & {
  handleCloseModal: () => void
}

const RealModal: FC<TProps> = ({
  children,
  show,
  width,
  showCloseBtn,
  mode: _mode,
  offsetTop = '20%',
  offsetLeft,
  compact = false,
  handleCloseModal,
}) => {
  const s = useSalon({ visible: show, compact })

  const { glowType } = useTopGlow()
  const { theme } = useTheme()

  const visibleOnPageRef = useRef(false)

  const handleClose = useCallback(() => {
    visibleOnPageRef.current = false
    toggleGlobalBlur(false)
    handleCloseModal()
    unlockPage()
  }, [handleCloseModal])

  useShortcut('Escape', handleClose)

  const handleEnterPage = useCallback(() => {
    visibleOnPageRef.current = true
    if (!show) return

    toggleGlobalBlur(true)
    lockPage()
  }, [show])

  useEffect(() => {
    if (show || !visibleOnPageRef.current) return

    visibleOnPageRef.current = false
    toggleGlobalBlur(false)
  }, [show])

  useEffect(() => {
    return () => {
      visibleOnPageRef.current = false
      toggleGlobalBlur(false)
      unlockPage()
    }
  }, [])

  if (!show) return null

  return (
    <Portal>
      <div
        role='presentation'
        aria-hidden='true'
        aria-label='Close modal'
        className={cn(s.mask, !show && 'opacity-0')}
        onClick={handleClose}
      >
        <div
          className={cn(s.wrapper, show && 'animate-fade-up animate-duration-300')}
          style={{
            width,
            top: offsetTop,
            marginLeft: offsetLeft,
          }}
        >
          <div
            role='presentation'
            aria-hidden='true'
            onClick={(e) => e.stopPropagation()}
            className={s.glowLight}
            style={s.glowLightStyle(glowType, theme)}
          />
          <ViewportTracker onEnter={handleEnterPage} />
          {showCloseBtn && (
            <button type='button' className={s.closeBox} onKeyUp={handleClose}>
              <CloseCrossSVG className={s.closeIcon} />
            </button>
          )}
          {/* {showCloseBtn && <EscHint mode={mode}>Esc</EscHint>} */}
          <div
            role='presentation'
            aria-hidden='true'
            className={s.children}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </Portal>
  )
}

export default RealModal
