import { type FC, memo, useEffect } from 'react'

import type { TSpace } from '~/spec'
import { countWords } from './helper'
import useSalon, { cn } from './salon'

type TProps = {
  body: string
  max?: number
  min?: number
  onChange?: (isValid: boolean) => void
} & TSpace

const WordsCounter: FC<TProps> = ({ body, max = 2000, min = 10, onChange, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const currentCount = countWords(body)
  const invalid = currentCount < min || currentCount > max

  useEffect(() => {
    const isValid = currentCount >= min && currentCount <= max
    onChange?.(isValid)
  }, [currentCount, onChange, min, max])

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>当前</div>
      <div className={s.main}>
        <div className={cn(s.curNum, invalid && s.invalid)}>{currentCount}</div>{' '}
        <div className={s.slash}>/</div>{' '}
        {currentCount < min && <div className={s.total}>{min}</div>}
        {currentCount >= min && <div className={s.total}>{max}</div>}
      </div>
      {currentCount < min && <div className={s.hint}>字最少</div>}
      {currentCount >= min && <div className={s.hint}>字最多</div>}
    </div>
  )
}

export default memo(WordsCounter)
