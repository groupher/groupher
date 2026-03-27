import { useState } from 'react'

type TRet = {
  touched: boolean
  setTouched: (value: boolean) => void
  resetTouched: () => void
}

/**
 * for SubMenu Footer confirm UI
 */
const useTouched = (): TRet => {
  const [touched, setTouched] = useState(false)

  return {
    touched,
    setTouched,
    resetTouched: () => {
      setTimeout((): void => {
        setTouched(false)
      }, 500)
    },
  }
}

export default useTouched
