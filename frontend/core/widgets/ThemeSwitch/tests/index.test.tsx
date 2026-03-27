import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import THEME, { THEME_MODE } from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import setupThemeStore from '~/stores/theme'
import { StoreContext } from '~/stores/theme/provider'
import ThemeSwitch from '~/widgets/ThemeSwitch'

describe('<ThemeSwitch />', () => {
  it('keeps the SSR-safe system placeholder until hydration completes', async () => {
    const store = setupThemeStore(THEME_MODE.LIGHT, THEME.LIGHT)
    const Wrapper = makeStoreWrapper()
    const ui = (
      <Wrapper>
        <StoreContext.Provider value={store}>
          <ThemeSwitch />
        </StoreContext.Provider>
      </Wrapper>
    )

    expect(renderToString(ui)).toContain('system mode')

    render(ui)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'light mode' })).toBeInTheDocument()
    })
  })
})
