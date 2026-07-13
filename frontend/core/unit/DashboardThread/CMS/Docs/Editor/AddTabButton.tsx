import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useTrans from '~/hooks/useTrans'
import TabsAddSVG from '~/icons/TabsAdd'
import { send } from '~/lib/signal'
import Button from '~/widgets/Buttons/Button'

type TProps = {
  placement?: 'breadcrumb' | 'drawer'
  onClick?: () => void
}

const AddTabButton = ({ placement = 'breadcrumb', onClick }: TProps) => {
  const { t } = useTrans()
  const label = t('dsb.doc.empty_action.add_tab')
  const className =
    placement === 'drawer'
      ? 'row-center min-h-10 w-full justify-start px-2 hover:bg-transparent'
      : 'row-center min-h-10 justify-end hover:bg-transparent'

  return (
    <Button
      ghost
      noBorder
      space={0}
      ariaLabel={label}
      className={className}
      onClick={onClick ?? (() => send(DSB_DOC_EVENT.ADD_TAB))}
    >
      <TabsAddSVG className='mr-1.5 size-4' />
      <span>{label}</span>
    </Button>
  )
}

export default AddTabButton
