import useAccount from '~/stores/account/hooks'

import MyReportsDialog from './MyReportsDialog'

type TProps = { show: boolean; onClose: () => void }

/** Lets the signed-in reporter withdraw active reports even when targets are hidden. */
export default function MyReports({ show, onClose }: TProps) {
  const { accountRef } = useAccount()

  if (!show) return null

  return (
    <MyReportsDialog key={accountRef || 'anonymous'} accountRef={accountRef} onClose={onClose} />
  )
}
