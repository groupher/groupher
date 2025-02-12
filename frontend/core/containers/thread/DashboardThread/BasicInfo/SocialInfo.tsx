import SocialEditor from '~/widgets/SocialEditor'

import { SETTING_FIELD } from '../constant'
import SavingBar from '../SavingBar'

import useBaseInfo from '../logic/useBaseInfo'
import useSalon from '../salon/basic_info/base_info'

export default () => {
  const s = useSalon()
  const { socialLinks, saving, isSocialLinksTouched, edit } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <SocialEditor
        value={socialLinks}
        onChange={(links) => {
          // @ts-ignore
          edit(links, 'socialLinks')
        }}
      />

      <SavingBar
        isTouched={isSocialLinksTouched}
        field={SETTING_FIELD.SOCIAL_LINKS}
        loading={saving}
        top={50}
      />
    </div>
  )
}
