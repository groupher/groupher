import useUserListModal from '~/hooks/useUserListModal'
import CustomScroller from '~/widgets/CustomScroller'
import Modal from '~/widgets/Modal'
import UserList from '~/widgets/UserList'

import useSalon from './salon'

export default function UserListModal() {
  const s = useSalon()
  const { show, onClose } = useUserListModal()

  return (
    <Modal show={show} width='400px' onClose={onClose} showCloseBtn>
      <div className={s.wrapper}>
        <h2>List Modal</h2>

        <CustomScroller>
          <UserList />
        </CustomScroller>
      </div>
    </Modal>
  )
}
