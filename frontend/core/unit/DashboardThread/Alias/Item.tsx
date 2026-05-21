import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSolid'
import AddButton from '~/widgets/Buttons/AddButton'
import Input from '~/widgets/Input'

import { BUILD_IN_ALIAS_SUGGESTIONS, FIELD } from '../constant'
import useAlias from '../logic/useAlias'
import SavingBar from '../SavingBar'
import type { TNameAlias } from '../spec'
import useSalon, { cn } from './salon/item'
import Suggestion from './Suggestion'

type TProps = {
  alias: TNameAlias
}

const Item: FC<TProps> = ({ alias }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { updateEditingAlias, editingAlias, resetEdit } = useAlias()

  const isEditMode: boolean = alias.slug === editingAlias?.slug
  const isChanged: boolean = alias.original !== alias.name

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        {isEditMode ? (
          <SavingBar isTouched field={FIELD.NAME_ALIAS}>
            <div className={s.inputWrapper}>
              <Input
                className={s.input}
                value={editingAlias?.name}
                focusOnMount
                onChange={(e) => updateEditingAlias({ ...editingAlias, name: e.target.value })}
              />
            </div>
          </SavingBar>
        ) : (
          <div className={s.title}>{alias.original}</div>
        )}

        {!isEditMode && isChanged && (
          <>
            <div className={s.arrowBar}>
              <div className={s.arrowLine} />
              <ArrowSVG className={s.arrowIcon} />
            </div>
            <div className={cn(s.title, 'w-auto')}>{alias.name}</div>
          </>
        )}
      </div>
      <div className={s.footer}>
        {isEditMode ? (
          <Suggestion
            items={BUILD_IN_ALIAS_SUGGESTIONS[alias.slug]}
            onChange={(name) => updateEditingAlias({ ...alias, name })}
          />
        ) : (
          <>
            <AddButton
              top={10}
              icon='edit'
              dimWhenIdle
              right={4}
              onClick={() => updateEditingAlias(alias)}
            >
              {t('dsb.alias.edit')}
            </AddButton>
            {isChanged && (
              <AddButton
                top={10}
                withIcon={false}
                dimWhenIdle
                onClick={() => {
                  updateEditingAlias({ ...alias, name: alias.original })
                  resetEdit()
                }}
              >
                {t('dsb.alias.reset')}
              </AddButton>
            )}
          </>
        )}
        <div className='grow' />
      </div>
    </div>
  )
}

export default Item
