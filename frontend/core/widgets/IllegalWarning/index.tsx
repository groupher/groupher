import { type FC, Fragment } from 'react'

import useSalon from './salon'

type TProps = {
  illegalReason: string[]
  illegalWords: string[]
}

const IllegalWarning: FC<TProps> = ({ illegalReason, illegalWords }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>
        包含 [
        {illegalReason.map((reason, index) => (
          <Fragment key={reason}>
            <div className={s.reason}>{reason}</div>
            {index !== illegalReason.length - 1 && <>|</>}
          </Fragment>
        ))}
        ] 内容:
      </div>

      <div className={s.content}>
        {illegalWords.map((word) => (
          <div className={s.illegalItem} key={word}>
            {word}
          </div>
        ))}
      </div>
    </div>
  )
}

export default IllegalWarning
