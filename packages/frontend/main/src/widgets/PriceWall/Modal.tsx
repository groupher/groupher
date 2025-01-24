import { useState } from 'react'

import Modal from '~/widgets/Modal'

import PriceWall from '.'

export default () => {
  const [show, setShow] = useState(false)

  return (
    <Modal show={show} width="1080px" offsetLeft="12%" onClose={() => setShow(false)} showCloseBtn>
      <PriceWall layout="modal" />
    </Modal>
  )
}
