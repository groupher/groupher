import { type FC, useMemo, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import IconHub from '~/widgets/IconHub'
import SwitcherTabs from '~/widgets/Switcher/Tabs'

import type { TSideTreeController } from '../SideTree/spec'
import useSalon from './salon'
import SettingsDrawer from './SettingsDrawer'

type TProps = {
  controller: TSideTreeController
  submenuCollapsed: boolean
}

const Tabs: FC<TProps> = ({ controller, submenuCollapsed }) => {
  const s = useSalon({ submenuCollapsed })
  const { t } = useTrans()
  const [showSettings, setShowSettings] = useState(false)
  const showTabs = controller.tabs.length >= 2
  const settingsVisible = showTabs && showSettings
  const items = useMemo(
    () => controller.tabs.map((tab) => ({ slug: tab.id, label: tab.title })),
    [controller.tabs],
  )

  return (
    <>
      {showTabs && (
        <div className={s.wrapper} aria-label='Docs tabs'>
          <div className={s.tabsViewport}>
            <SwitcherTabs
              items={items}
              activeKey={controller.activeTabId ?? ''}
              variant='docs'
              onChange={(tabId) => controller.activateTab(tabId)}
            />
          </div>

          <button
            type='button'
            className={s.settingsButton}
            aria-label={t('dsb.doc.tabs.settings')}
            title={t('dsb.doc.tabs.settings')}
            onClick={() => setShowSettings(true)}
          >
            <span className={s.settingsIconBox}>
              <IconHub
                provider='phosphor'
                icon='sliders-horizontal'
                size={4.5}
                className={s.settingsIcon}
              />
            </span>
          </button>
        </div>
      )}

      <SettingsDrawer
        controller={controller}
        show={settingsVisible}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}

export default Tabs
