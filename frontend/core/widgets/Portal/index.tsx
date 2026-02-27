import { createPortal } from 'react-dom'

const Portal = ({ children }) => {
  if (typeof window === 'undefined') return null
  return createPortal(children, document.body)
}

export default Portal
