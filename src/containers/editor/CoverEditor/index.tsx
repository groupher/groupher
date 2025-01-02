/* *
 * CoverEditor
 *
 */

import type { FC } from 'react'

import Cover from './Cover'
import Toolbox from './Toolbox'

import useSalon from './styles'

type TProps = {
  onDelete?: () => void
  onReplace?: () => void
}

const CoverEditor: FC<TProps> = ({ onDelete = console.log, onReplace = console.log }) => {
  const s = useSalon()
  // const imageUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/385126/600.jpg'
  // const imageUrl = '/changelog-demo-light.jpg'
  const imageUrl = '/changelog-demo-dark.jpg'
  // const imageUrl = ''

  return (
    <div className={s.wrapper}>
      <Cover imageUrl={imageUrl} />
      <Toolbox onDelete={onDelete} onReplace={onReplace} />
    </div>
  )
}

export default CoverEditor
