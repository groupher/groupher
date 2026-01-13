import { type FC, memo, type ReactNode, useCallback } from 'react'

import useShortcut from '~/hooks/useShortcut'

import RealModal from './RealModal'

export type TProps = {
  children: ReactNode
  show?: boolean
  width?: string
  showCloseBtn?: boolean
  mode?: 'default' | 'error'
  background?: 'default' | 'preview'
  offsetTop?: string
  offsetLeft?: string
  onClose?: () => void
}

const Modal: FC<TProps> = ({ show = false, onClose = console.log, ...restProps }) => {
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useShortcut('Escape', handleClose)

  return <RealModal {...restProps} handleCloseModal={handleClose} show={show} />
}

export default memo(Modal)
