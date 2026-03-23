import type { FC } from 'react'
import useCommunity from '~/stores/community/hooks'
import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'
import useSalon from '../salon/domain/platform'

const Domain: FC = () => {
  const s = useSalon()
  const community = useCommunity()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('dsb.domain.platform.title')}</div>
      <div className={s.desc}>
        {t('dsb.domain.platform.desc_prefix')}
        {community.slug}
        {t('dsb.domain.platform.desc_middle')}
        {community.slug}
        {t('dsb.domain.platform.desc_suffix')}
      </div>

      <div className={s.inputWrapper}>
        <Input value='www' disableEnter autoFocus className='w-44' />
        <div className={s.domainText}>
          .groupher.com<span className={s.domainSlug}>/{community.slug}/*</span>
        </div>
      </div>

      <Button disabled={false} onClick={console.log}>
        {t('dsb.domain.platform.update')}
      </Button>
    </div>
  )
}

export default Domain
