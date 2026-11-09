import useTrans from '~/hooks/useTrans'
import type { TTicket } from '~/spec'
import Button from '~/ui/Buttons/Button'
import Modal from '~/ui/Modal'

import useSalon from './salon/publication_review'

type TProps = {
  ticket: TTicket | null
  show: boolean
  reason: string
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function TicketPublicationReview({
  ticket,
  show,
  reason,
  pending,
  onClose,
  onConfirm,
}: TProps) {
  const { t } = useTrans()
  const s = useSalon()
  if (!ticket) return null
  const superseded = new Set(
    ticket.updates.flatMap((update) => (update.supersedesId ? [update.supersedesId] : [])),
  )
  const updates = ticket.updates.filter(
    (update) => update.visibility === 'PUBLIC' && !superseded.has(update.id),
  )
  return (
    <Modal show={show} width='520px' onClose={onClose} showCloseBtn>
      <div className={s.wrapper} role='alertdialog' aria-modal='true'>
        <div>
          <h2 className={s.title}>{t('ticket.workbench.publish_review_title')}</h2>
          <p className={s.hint}>{t('ticket.workbench.publish_review_hint')}</p>
        </div>
        <div className={s.content}>
          <div className={s.head}>
            <h3 className={s.heading}>{ticket.title}</h3>
            <p className={s.summary}>
              {ticket.digest || t('ticket.workbench.publish_review_no_summary')}
            </p>
          </div>
          <div className={s.body}>{ticket.plainText}</div>
          <ul>
            {ticket.sources
              .filter((source) => source.isPublic === true)
              .map((source) => (
                <li key={source.id}>
                  #{source.innerId} · {source.title}
                </li>
              ))}
          </ul>
          <div className={s.updates}>
            {updates.map((update) => (
              <p key={update.id} className={s.body}>
                {update.body}
              </p>
            ))}
          </div>
        </div>
        <p className={s.summary}>
          {t('ticket.workbench.visibility_reason')}: {reason.trim()}
        </p>
        <div className={s.actions}>
          <Button ghost disabled={pending} onClick={onClose}>
            {t('ticket.workbench.cancel_publish')}
          </Button>
          <Button disabled={pending} loading={pending} onClick={onConfirm}>
            {t('ticket.workbench.confirm_publish')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
