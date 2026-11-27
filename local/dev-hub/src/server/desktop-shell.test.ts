import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

type TTab = {
  root: string
  name: string
  branch: string
  status: string
  url?: string
  error?: string
}
type TDesktop = { sync: (payload: { tabs: TTab[]; focus: string | null }) => void }
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (
    html: string,
    options: object,
  ) => { window: Window & typeof globalThis & { __DEV_HUB_DESKTOP__: TDesktop; close: () => void } }
}

test('desktop tabs retain their own frames and closing a tab does not close another', async () => {
  const html = await readFile(
    new URL('../../src-tauri/bootstrap/index.html', import.meta.url),
    'utf8',
  )
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://desktop.localhost/' })
  const { document, __DEV_HUB_DESKTOP__: desktop } = dom.window
  const a: TTab = {
    root: '/checkout/a',
    name: 'a',
    branch: 'main',
    status: 'ready',
    url: 'http://127.0.0.1:4312/?devhubInstance=a&devhubRoot=%2Fcheckout%2Fa',
  }
  const b: TTab = {
    root: '/checkout/b',
    name: 'b',
    branch: 'feature',
    status: 'ready',
    url: 'http://127.0.0.1:4313/?devhubInstance=b&devhubRoot=%2Fcheckout%2Fb',
  }
  try {
    desktop.sync({ tabs: [a, b], focus: b.root })
    const frames = [...document.querySelectorAll('iframe')]
    assert.equal(frames.length, 2)
    ;(document.querySelector('[role=tab]') as HTMLButtonElement).click()
    desktop.sync({ tabs: [a, b], focus: null })
    assert.equal(document.querySelector('iframe'), frames[0])
    assert.match(document.querySelector('[role=tab][aria-selected=true]')?.textContent || '', /a/)
    ;(document.querySelector('[aria-label="Close b tab"]') as HTMLButtonElement).click()
    desktop.sync({ tabs: [a, b], focus: null })
    assert.equal(
      (document.querySelector('[aria-label="Close b tab"]')?.parentElement as HTMLElement).hidden,
      true,
    )
    desktop.sync({ tabs: [a, b], focus: b.root })
    assert.equal(
      (document.querySelector('[aria-label="Close b tab"]')?.parentElement as HTMLElement).hidden,
      false,
    )
    assert.equal(document.querySelectorAll('iframe').length, 2)
  } finally {
    dom.window.close()
  }
})

test('desktop shell refuses a URL that does not match the tab checkout', async () => {
  const html = await readFile(
    new URL('../../src-tauri/bootstrap/index.html', import.meta.url),
    'utf8',
  )
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://desktop.localhost/' })
  try {
    dom.window.__DEV_HUB_DESKTOP__.sync({
      tabs: [
        {
          root: '/checkout/b',
          name: 'b',
          branch: 'feature',
          status: 'ready',
          url: 'http://127.0.0.1:4313/?devhubInstance=b&devhubRoot=%2Fcheckout%2Fa',
        },
      ],
      focus: '/checkout/b',
    })
    assert.equal(dom.window.document.querySelectorAll('iframe').length, 0)
    assert.match(dom.window.document.querySelector('#error')?.textContent || '', /Invalid Hub URL/)
  } finally {
    dom.window.close()
  }
})

test('desktop opens allowed URLs only for the active verified frame', async () => {
  const html = await readFile(new URL('../../src-tauri/bootstrap/index.html', import.meta.url), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://desktop.localhost/' })
  const calls: unknown[] = []
  Object.assign(dom.window, {
    __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => { calls.push(args); return Promise.resolve() } },
  })
  try {
    dom.window.__DEV_HUB_DESKTOP__.sync({ tabs: [{
      root: '/checkout/b', name: 'b', branch: 'feature', status: 'ready',
      url: 'http://127.0.0.1:4313/?devhubInstance=b&devhubRoot=%2Fcheckout%2Fb',
    }], focus: '/checkout/b' })
    const frame = dom.window.document.querySelector('iframe')!
    const send = (origin: string, url: string, source: MessageEventSource | null = frame.contentWindow) =>
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', { origin, source, data: { type: 'groupher-devhub-open-url', url } }))
    send('http://127.0.0.1:4313', 'https://dash.groupher-b.localhost/')
    send('http://127.0.0.1:4312', 'https://dash.groupher-b.localhost/')
    send('http://127.0.0.1:4313', 'https://evil.example/')
    send('http://127.0.0.1:4313', 'https://dash.groupher-b.localhost/', null)
    assert.equal(JSON.stringify(calls), JSON.stringify([['plugin:opener|open_url', { url: 'https://dash.groupher-b.localhost/' }]]))
  } finally {
    dom.window.close()
  }
})
