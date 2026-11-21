import { useEffect, useState, type FC } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'

import useSalon from './salon'
import { notices } from './schema'

const Notices: FC<{ community: string }> = ({ community }) => {
  const { t } = useTrans()
  const s = useSalon()
  const [items, setItems] = useState<{ event_id: string; status: string; inserted_at: string }[]>(
    [],
  )
  useEffect(() => {
    let active = true
    const load = () =>
      browserGraphQLRequest<{ docsPublicationNotices: { items: typeof items } }>(notices, {
        community,
      })
        .then((result) => {
          if (active) setItems(result.docsPublicationNotices.items)
        })
        .catch(() => {
          if (active) setItems([])
        })
    void load()
    const timer = window.setInterval(load, 15000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [community])
  return (
    <ul className={s.tree} aria-label={t('dsb.doc.publication.notices')}>
      {items.map((item) => (
        <li key={item.event_id}>
          {t(
            item.status === 'approved'
              ? 'dsb.doc.publication.notice_approved'
              : item.status === 'disabled'
                ? 'dsb.doc.publication.notice_disabled'
                : 'dsb.doc.publication.notice_pending',
          )}{' '}
          · {item.inserted_at}
        </li>
      ))}
    </ul>
  )
}
export default Notices
