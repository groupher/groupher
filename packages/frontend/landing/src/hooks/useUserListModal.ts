type TRes = {
  show: boolean
  onClose: () => void
}

const useUserListModal = (): TRes => {
  return {
    show: false,
    onClose: () => console.log('## TODO'),
  }
}

export default useUserListModal
