import SocialEditor from '~/widgets/SocialEditor'

import { FIELD } from '../constant'
import useBaseInfo from '../logic/useBaseInfo'
import SavingBar from '../SavingBar'
import useSalon from '../salon/basic_info/base_info'

export default () => {
  const s = useSalon()
  const { socialLinks, saving, isSocialLinksTouched, edit } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <SocialEditor
        value={socialLinks}
        onChange={(links) => {
          // @ts-expect-error
          edit(links, 'socialLinks')
        }}
      />

      <SavingBar
        isTouched={isSocialLinksTouched}
        field={FIELD.SOCIAL_LINKS}
        loading={saving}
        top={50}
      />
    </div>
  )
}
