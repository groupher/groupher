import { type FC, useCallback, useEffect, useRef } from 'react'

import { toggleGlobalBlur } from '~/dom'
import usePageLock from '~/hooks/usePageLock'
import useTheme from '~/hooks/useTheme'
import useTopGlow from '~/hooks/useTopGlow'
import CloseCrossSVG from '~/icons/CloseLight'
import Portal from '~/ui/Portal'
import ViewportTracker from '~/ui/ViewportTracker'

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
  const { lockPageOnce, unlockPageOnce } = usePageLock()

  const visibleOnPageRef = useRef(false)

  const handleClose = useCallback(() => {
    visibleOnPageRef.current = false
    toggleGlobalBlur(false)
    handleCloseModal()
    unlockPageOnce()
  }, [handleCloseModal, unlockPageOnce])

  const handleEnterPage = useCallback(() => {
    visibleOnPageRef.current = true
    if (!show) return

    toggleGlobalBlur(true)
    lockPageOnce()
  }, [show, lockPageOnce])

  // Portal mounts after its own effect; open the dialog when its DOM node actually attaches.
  const attachDialog = useCallback((dialog: HTMLDialogElement | null) => {
    if (!dialog) return
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    return () => {
      if (!dialog.open) return
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [])

  useEffect(() => {
    if (show || !visibleOnPageRef.current) return

    visibleOnPageRef.current = false
    toggleGlobalBlur(false)
    unlockPageOnce()
  }, [show, unlockPageOnce])

  useEffect(() => {
    return () => {
      visibleOnPageRef.current = false
      toggleGlobalBlur(false)
      unlockPageOnce()
    }
  }, [unlockPageOnce])

  if (!show) return null

  return (
    <Portal>
      <dialog
        ref={attachDialog}
        aria-label='Modal'
        className={cn(s.mask, !show && 'opacity-0')}
        onCancel={(event) => {
          event.preventDefault()
          handleClose()
        }}
      >
        <button
          type='button'
          aria-label='Close modal backdrop'
          className={s.backdrop}
          onClick={handleClose}
        />
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
            <button
              type='button'
              aria-label='Close modal'
              className={s.closeBox}
              onClick={handleClose}
            >
              <CloseCrossSVG className={s.closeIcon} />
            </button>
          )}
          {/* {showCloseBtn && <EscHint mode={mode}>Esc</EscHint>} */}
          <div role='presentation' className={s.children} onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        </div>
      </dialog>
    </Portal>
  )
}

export default RealModal
