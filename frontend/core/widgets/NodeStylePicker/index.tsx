'use client'

import { type FC, useState } from 'react'

import IconHub from '~/widgets/IconHub'
import { ICONS } from '~/widgets/IconHub/icons'
import { Tabs } from '~/widgets/Switcher'
import Tooltip from '~/widgets/Tooltip'

import ColorTab from './ColorTab'
import { DEFAULT_ICON_NAME, DEFAULT_PROVIDER, TAB, TAB_ITEMS } from './constant'
import EmojiTab from './EmojiTab'
import IconTab from './IconTab'
import useSalon from './salon'
import type { TNodeStyleIconValue, TNodeStylePickerProps, TTab } from './spec'

const NodeStylePicker: FC<TNodeStylePickerProps> = ({
  testid = 'node-style-picker',
  value,
  onChange = console.log,
}) => {
  const s = useSalon()

  const [tab, setTab] = useState<TTab>(TAB.ICON)
  const [panelOpen, setPanelOpen] = useState(false)
  const [innerValue, setInnerValue] = useState<TNodeStyleIconValue>({
    type: 'icon',
    provider: DEFAULT_PROVIDER,
    name: DEFAULT_ICON_NAME,
    src: ICONS[DEFAULT_PROVIDER][DEFAULT_ICON_NAME],
  })

  const selectedValue = value ?? innerValue

  const handleIconChange = (nextValue: TNodeStyleIconValue) => {
    setInnerValue(nextValue)
    onChange(nextValue)
  }

  return (
    <div className={s.wrapper} data-testid={testid}>
      <Tooltip
        placement='bottom-start'
        trigger='click'
        hideOnClick={false}
        offset={[0, 8]}
        maxWidth='24rem'
        noPadding
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        content={
          <div className={s.panel}>
            <Tabs
              items={TAB_ITEMS}
              activeKey={tab}
              onChange={(key) => setTab(key as TTab)}
              left={1.5}
              bottom={1.5}
            />

            <div className={s.content}>
              {tab === TAB.ICON && (
                <IconTab
                  panelOpen={panelOpen}
                  selectedValue={selectedValue}
                  onChange={handleIconChange}
                />
              )}

              {tab === TAB.COLOR && <ColorTab />}
              {tab === TAB.EMOJI && <EmojiTab />}
            </div>
          </div>
        }
      >
        <button type='button' className={s.trigger}>
          <IconHub
            provider={selectedValue.provider}
            icon={selectedValue.name}
            size={4.5}
            className={s.previewIconColor}
          />
        </button>
      </Tooltip>
    </div>
  )
}

export default NodeStylePicker
