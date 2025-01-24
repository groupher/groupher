/*
 *
 * SocialEditor
 *
 */

import type { FC } from 'react'

import type { TSocialItem } from '~/spec'

import { Trans } from '~/i18n'

import DeleteSVG from '~/icons/DeleteSolid'
import Input from '~/widgets/Input'

import useSalon, { Icon } from './salon/input_bar'

type TProps = {
  social: TSocialItem
  onChange: (type: string, value: string) => void
  onDelete: (social: TSocialItem) => void
}

const InputBar: FC<TProps> = ({ social, onDelete, onChange }) => {
  const s = useSalon()

  const SocalIcon = Icon[social.type]

  return (
    <div className={s.wrapper}>
      <div className={s.iconWrapper}>
        <SocalIcon className={s.icon} />
      </div>
      <Input
        placeholder={Trans(social.type)}
        value={social.link}
        onChange={(e) => onChange(social.type, e.target.value)}
      />
      <DeleteSVG onClick={() => onDelete(social)} className={s.deleteIcon} />
    </div>
  )
}

export default InputBar
