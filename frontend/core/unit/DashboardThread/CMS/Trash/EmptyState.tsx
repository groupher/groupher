import useTrans from '~/hooks/useTrans'

import useSalon from './salon'

export default function EmptyState() {
  const s = useSalon()
  const { t } = useTrans()

  return <div className={s.empty}>{t('dsb.cms.trash.empty')}</div>
}
