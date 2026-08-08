import type { TRichEditorOutlineItem } from '@groupher/rich-editor'
import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/Check'
import ChevronDownSVG from '~/icons/ChevronDown'
import Tooltip from '~/ui/Tooltip'

import useSalon from './salon/insert_action'
import type { TImportTarget } from './spec'

type TProps = {
  cursorAvailable: boolean
  disabled: boolean
  inserting: boolean
  label: string
  outline: TRichEditorOutlineItem[]
  sectionKey: string
  target: TImportTarget
  onInsert: () => void
  onSectionChange: (key: string) => void
  onTargetChange: (target: TImportTarget) => void
}

const InsertAction: FC<TProps> = ({
  cursorAvailable,
  disabled,
  inserting,
  label,
  outline,
  sectionKey,
  target,
  onInsert,
  onSectionChange,
  onTargetChange,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const [menuOpen, setMenuOpen] = useState(false)

  const selectTarget = (nextTarget: TImportTarget): void => {
    onTargetChange(nextTarget)
  }

  const selectSection = (key: string): void => {
    onSectionChange(key)
    onTargetChange('section-end')
  }

  const menuContent = (
    <div role='menu' className={s.menu}>
      <button
        type='button'
        role='menuitemradio'
        aria-checked={target === 'document-end'}
        className={s.menuItem(target === 'document-end')}
        onClick={() => selectTarget('document-end')}
      >
        <span className={s.itemLabel}>{t('dsb.doc.import.target.end')}</span>
        <CheckSVG className={s.check(target === 'document-end')} />
      </button>
      <button
        type='button'
        role='menuitemradio'
        aria-checked={target === 'document-start'}
        className={s.menuItem(target === 'document-start')}
        onClick={() => selectTarget('document-start')}
      >
        <span className={s.itemLabel}>{t('dsb.doc.import.target.start')}</span>
        <CheckSVG className={s.check(target === 'document-start')} />
      </button>
      <button
        type='button'
        role='menuitemradio'
        aria-checked={target === 'saved-cursor'}
        className={s.menuItem(target === 'saved-cursor')}
        disabled={!cursorAvailable}
        onClick={() => selectTarget('saved-cursor')}
      >
        <span className={s.itemLabel}>{t('dsb.doc.import.target.cursor')}</span>
        <CheckSVG className={s.check(target === 'saved-cursor')} />
      </button>

      <div className={s.divider} />
      <div className={s.sectionLabel}>{t('dsb.doc.import.target.section')}</div>
      <div className={s.sectionList}>
        {outline.length > 0 ? (
          outline.map((item) => {
            const active = target === 'section-end' && sectionKey === item.key

            return (
              <button
                key={item.key}
                type='button'
                role='menuitemradio'
                aria-checked={active}
                className={s.sectionItem(active)}
                style={{ paddingLeft: 10 + Math.max(0, item.level - 1) * 12 }}
                onClick={() => selectSection(item.key)}
              >
                <span className={s.itemLabel}>
                  {item.text || t('dsb.doc.import.target.untitled_section')}
                </span>
                <CheckSVG className={s.check(active)} />
              </button>
            )
          })
        ) : (
          <div className={s.emptySection}>{t('dsb.doc.import.target.no_sections')}</div>
        )}
      </div>
    </div>
  )

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        className={s.mainButton}
        disabled={disabled}
        aria-busy={inserting}
        onClick={onInsert}
      >
        {label}
      </button>
      <Tooltip
        trigger='click'
        placement='top-end'
        offset={[0, 8]}
        content={menuContent}
        noPadding
        onShow={() => setMenuOpen(true)}
        onHide={() => setMenuOpen(false)}
      >
        <button
          type='button'
          className={s.menuButton}
          disabled={disabled}
          aria-haspopup='menu'
          aria-expanded={menuOpen}
          aria-label={t('dsb.doc.import.target.title')}
        >
          <ChevronDownSVG className={s.chevron(menuOpen)} />
        </button>
      </Tooltip>
    </div>
  )
}

export default InsertAction
