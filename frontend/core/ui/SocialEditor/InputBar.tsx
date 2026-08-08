/*
 *
 * SocialEditor
 *
 */

import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import DeleteSVG from '~/icons/DeleteSolid'
import LinkSVG from '~/icons/Link'
import type { TSocialItem } from '~/spec'
import Input from '~/ui/Input'

import useSalon, { Icon } from './salon/input_bar'

type TProps = {
  social: TSocialItem
  onChange: (type: string, value: string) => void
  onDelete: (social: TSocialItem) => void
}

const InputBar: FC<TProps> = ({ social, onDelete, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  // Existing communities may retain a legacy social type no longer shown in
  // the picker. Preserve that saved link instead of failing the editor render.
  const SocialIcon = Icon[social.type] || LinkSVG

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
