import { useEffect, type RefObject } from 'react'

const useOutsideClick = (ref: RefObject<HTMLElement>, callback?: (e) => void): void => {
  const handleClick = (e): void => {
    if (ref.current && !ref.current.contains(e.target)) {
      callback?.(e)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  })
}

export default useOutsideClick
