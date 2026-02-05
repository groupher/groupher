/*
 *
 * SocialEditor
 *
 */

import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import DeleteSVG from '~/icons/DeleteSolid'
import type { TSocialItem } from '~/spec'
import Input from '~/widgets/Input'

import useSalon, { Icon } from './salon/input_bar'

type TProps = {
  social: TSocialItem
  onChange: (type: string, value: string) => void
  onDelete: (social: TSocialItem) => void
}

const InputBar: FC<TProps> = ({ social, onDelete, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  const SocialIcon = Icon[social.type]

  return (
    <div className={s.wrapper}>
      <div className={s.iconWrapper}>
        <SocialIcon className={s.icon} />
      </div>
      <Input
        placeholder={t(social.type)}
        value={social.link}
        onChange={(e) => onChange(social.type, e.target.value)}
      />
      <DeleteSVG onClick={() => onDelete(social)} className={s.deleteIcon} />
    </div>
  )
}

export default InputBar
