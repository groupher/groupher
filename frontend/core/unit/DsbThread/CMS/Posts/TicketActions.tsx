'use client'

import { useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TArticle } from '~/spec'
import Button from '~/ui/Buttons/Button'

import TicketActionsModal from './TicketActionsModal'

export default function TicketActions({ post }: { post: TArticle }) {
  const { t } = useTrans()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size='small' soft disabled={!post.id} onClick={() => setOpen(true)}>
        {t('ticket.management.title')}
      </Button>
      <TicketActionsModal post={post} show={open} onClose={() => setOpen(false)} />
    </>
  )
}
