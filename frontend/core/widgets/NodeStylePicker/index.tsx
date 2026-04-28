'use client'

import { type FC, useState } from 'react'

import type { TNodeStyleValue } from '~/spec'
import { ICONS } from '~/widgets/IconHub/icons'
import NodeStyleRender from '~/widgets/NodeStyleRender'
import { Tabs } from '~/widgets/Switcher'
import Tooltip from '~/widgets/Tooltip'

import ColorTab from './ColorTab'
import { DEFAULT_ICON_NAME, DEFAULT_PROVIDER, TAB, TAB_ITEMS } from './constant'
import EmojiTab from './EmojiTab'
import IconTab from './IconTab'
import useSalon from './salon'
import type { TNodeStylePickerProps, TTab } from './spec'

const NodeStylePicker: FC<TNodeStylePickerProps> = ({
  testid = 'node-style-picker',
  value,
  onChange = console.log,
}) => {
  const s = useSalon()

  const [tab, setTab] = useState<TTab>(TAB.ICON)
  const [panelOpen, setPanelOpen] = useState(false)
  const [mountedTabs, setMountedTabs] = useState<Record<TTab, boolean>>({
    [TAB.ICON]: true,
    [TAB.COLOR]: false,
    [TAB.EMOJI]: false,
  })
  const [innerValue, setInnerValue] = useState<TNodeStyleValue>({
    type: 'icon',
    provider: DEFAULT_PROVIDER,
    name: DEFAULT_ICON_NAME,
    src: ICONS[DEFAULT_PROVIDER][DEFAULT_ICON_NAME],
  })

  const selectedValue = value ?? innerValue

  const handleStyleChange = (nextValue: TNodeStyleValue) => {
    setInnerValue(nextValue)
    onChange(nextValue)
  }

  const handleTabChange = (key: TTab) => {
    setTab(key)
    setMountedTabs((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
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
              onChange={(key) => handleTabChange(key as TTab)}
              left={1.5}
              bottom={1.5}
            />

            <div className={s.content}>
              {mountedTabs[TAB.ICON] && (
                <div className={tab === TAB.ICON ? s.tabPanel : s.tabPanelHidden}>
                  <IconTab
                    panelOpen={panelOpen}
                    selectedValue={selectedValue}
                    onChange={handleStyleChange}
                  />
                </div>
              )}

              {mountedTabs[TAB.COLOR] && (
                <div className={tab === TAB.COLOR ? s.tabPanel : s.tabPanelHidden}>
                  <ColorTab />
                </div>
              )}

              {mountedTabs[TAB.EMOJI] && (
                <div className={tab === TAB.EMOJI ? s.tabPanel : s.tabPanelHidden}>
                  <EmojiTab onChange={handleStyleChange} />
                </div>
              )}
            </div>
          </div>
        }
      >
        <button type='button' className={s.trigger}>
          <NodeStyleRender value={selectedValue} size={18} iconClassName={s.previewIconColor} />
        </button>
      </Tooltip>
    </div>
  )
}

export default NodeStylePicker
