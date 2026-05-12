import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useSalon from './salon/links_hint'
import type { TLinksHintProps } from './spec'

const LinksHint: FC<TLinksHintProps> = ({ count, empty = false }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (empty) {
    return <div className={s.empty}>{t('dsb.link_editor.no_links_in_group')}</div>
  }

  return (
    <div className={s.count}>
      {count}{' '}
      {t(count === 1 ? 'dsb.link_editor.link_count.one' : 'dsb.link_editor.link_count.other')}
    </div>
  )
}

export default LinksHint
