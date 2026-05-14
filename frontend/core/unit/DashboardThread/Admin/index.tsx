import { useState } from 'react'

import EVENT from '~/const/event'
import TYPE from '~/const/type'
import useEvent from '~/hooks/useEvent'
import { closeDrawer } from '~/signal'
import PassportEditor from '~/unit/PassportEditor'
import Drawer from '~/widgets/Drawer'

import Adder from './Adder'
import List from './List'

type TDrawerPayload = {
  type?: string
}

export default function Admin() {
  const [showPassportEditor, setShowPassportEditor] = useState(false)

  useEvent<TDrawerPayload>(EVENT.DRAWER.OPEN, (_msg, data) => {
    if (data?.type === TYPE.DRAWER.PASSPORT_EDITOR) {
      setShowPassportEditor(true)
    } else {
      setShowPassportEditor(false)
    }
  })

  useEvent<TDrawerPayload>(EVENT.DRAWER.CLOSE, (_msg, data) => {
    if (!data?.type || data.type === TYPE.DRAWER.PASSPORT_EDITOR) {
      setShowPassportEditor(false)
    }
  })

  return (
    <>
      <Adder />
      <List />
      <Drawer
        show={showPassportEditor}
        type={TYPE.DRAWER.PASSPORT_EDITOR}
        onClose={() => closeDrawer(TYPE.DRAWER.PASSPORT_EDITOR)}
      >
        <PassportEditor />
      </Drawer>
    </>
  )
}
