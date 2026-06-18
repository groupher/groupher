'use client'

import EmojiPicker, { Categories, EmojiStyle, Theme } from 'emoji-picker-react'
import type { CSSProperties, FC, ReactNode } from 'react'

import { MARKER } from '~/const/marker'
import { camelize } from '~/fmt'
import useOverlayDark from '~/hooks/useOverlayDark'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTheme from '~/hooks/useTheme'
import CoffeeDuoSVG from '~/icons/CoffeeDuo'
import EmojiSmileSVG from '~/icons/EmojiSmile'
import FlagSVG from '~/icons/Flag'
import GameSVG from '~/icons/Game'
import HashTagSVG from '~/icons/HashTag'
import PlaneSVG from '~/icons/Plane'
import PuzzleSVG from '~/icons/Puzzle'
import SeedSVG from '~/icons/Seed'
import WatchSVG from '~/icons/Watch'
import type { TMarkerValue } from '~/spec'

import useSalon from '../salon'

import scrollStyles from '../scroll.module.css'
import styles from './index.module.css'

type TProps = {
  open: boolean
  onChange: (value: TMarkerValue) => void
}

const renderCategoryIcon = (icon: ReactNode) => (
  <span className={styles.categoryIcon} aria-hidden='true'>
    {icon}
  </span>
)

const EmojiTab: FC<TProps> = ({ open, onChange }) => {
  const s = useSalon()
  const overlayDark = useOverlayDark()
  const primaryColor = usePrimaryColor()
  const { isDarkTheme } = useTheme()
  const primaryColorKey = camelize(primaryColor)
  const primary = `var(--color-rainbow-${primaryColorKey})`
  const pickerTheme = overlayDark || isDarkTheme ? Theme.DARK : Theme.LIGHT
  const categoryIcons = {
    [Categories.SUGGESTED]: renderCategoryIcon(<WatchSVG />),
    [Categories.SMILEYS_PEOPLE]: renderCategoryIcon(<EmojiSmileSVG />),
    [Categories.ANIMALS_NATURE]: renderCategoryIcon(<SeedSVG />),
    [Categories.FOOD_DRINK]: renderCategoryIcon(<CoffeeDuoSVG />),
    [Categories.TRAVEL_PLACES]: renderCategoryIcon(<PlaneSVG />),
    [Categories.ACTIVITIES]: renderCategoryIcon(<GameSVG />),
    [Categories.OBJECTS]: renderCategoryIcon(<PuzzleSVG />),
    [Categories.SYMBOLS]: renderCategoryIcon(<HashTagSVG />),
    [Categories.FLAGS]: renderCategoryIcon(<FlagSVG />),
  }
  const pickerStyle = {
    '--emoji-picker-primary-color': primary,
    '--epr-highlight-color': primary,
    '--epr-picker-border-color': 'var(--color-divider)',
    '--epr-text-color': 'var(--color-digest)',
    '--epr-search-input-text-color': 'var(--color-title)',
    '--epr-search-input-placeholder-color': 'var(--color-digest)',
    '--epr-search-input-bg-color': 'var(--color-card)',
    '--epr-search-input-bg-color-active': 'var(--color-card)',
    '--epr-search-border-color': 'var(--color-divider)',
    '--epr-search-border-color-active': 'var(--color-divider)',
    '--epr-hover-bg-color': 'var(--color-menuHoverBg)',
    '--epr-hover-bg-color-reduced-opacity': 'var(--color-menuHoverBg)',
    '--epr-focus-bg-color': 'var(--color-menuHoverBg)',
    '--epr-category-icon-active-color': primary,
    '--epr-emoji-hover-color': 'var(--color-menuHoverBg)',
    '--epr-emoji-variation-indicator-color': 'var(--color-divider)',
    '--epr-emoji-variation-indicator-color-hover': 'var(--color-title)',
    '--epr-dark-bg-color': 'transparent',
    '--epr-skin-tone-picker-menu-color': 'var(--color-popover-bg)',
    '--epr-dark-picker-border-color': 'var(--color-divider)',
    '--epr-dark-text-color': 'var(--color-digest)',
    '--epr-dark-search-input-bg-color': 'var(--color-card)',
    '--epr-dark-search-input-bg-color-active': 'var(--color-card)',
    '--epr-dark-hover-bg-color': 'var(--color-menuHoverBg)',
    '--epr-dark-hover-bg-color-reduced-opacity': 'var(--color-menuHoverBg)',
    '--epr-dark-focus-bg-color': 'var(--color-menuHoverBg)',
    '--epr-dark-category-label-bg-color': 'var(--color-popover-bg)',
    '--epr-dark-category-icon-active-color': primary,
    '--epr-dark-emoji-variation-indicator-color': 'var(--color-divider)',
    '--epr-search-input-height': '32px',
    '--epr-search-input-padding': '0 32px',
    '--epr-category-navigation-button-size': '22px',
    '--epr-category-label-height': '20px',
    '--epr-emoji-size': '18px',
    '--epr-emoji-padding': '12px',
    '--epr-header-padding': '8px 10px',
    '--epr-category-padding': '4px 18px 6px 10px',
    '--epr-category-label-padding': '0 18px 0 18px',
    '--epr-preview-height': '48px',
  } as CSSProperties

  return (
    <div className={s.emojiWrapper}>
      <EmojiPicker
        className={`${s.emojiPicker} ${scrollStyles.emojiPicker} ${styles.emojiPicker}`}
        open={open}
        theme={pickerTheme}
        emojiStyle={EmojiStyle.TWITTER}
        lazyLoadEmojis
        autoFocusSearch={false}
        previewConfig={{ showPreview: true }}
        categoryIcons={categoryIcons}
        width='100%'
        height={320}
        style={pickerStyle}
        onEmojiClick={(emojiData) =>
          onChange({
            type: MARKER.EMOJI,
            unified: emojiData.unified,
          })
        }
      />
    </div>
  )
}

export default EmojiTab
