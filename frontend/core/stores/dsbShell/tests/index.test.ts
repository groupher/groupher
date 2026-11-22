import { createDsbShellStore } from '..'
import { readDemoFields, writeDemoFields } from '../demoFields'
import type { TDsbEditableFields } from '../spec'

const fields = (title: string, desc: string): TDsbEditableFields =>
  ({ title, desc }) as TDsbEditableFields

describe('DsbShellStore', () => {
  it('keeps new input while reconciling a confirmed submitted value', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.edit('title', 'B')
    store.reconcile({ fields: ['title'], submitted: { title: 'B' }, confirmed: { title: 'B' } })

    expect(store.title).toBe('B')
    expect(store.original.title).toBe('B')
    expect(store.isTouched('title')).toBe(false)

    store.edit('title', 'C')
    store.reconcile({ fields: ['title'], submitted: { title: 'B' }, confirmed: { title: 'B' } })

    expect(store.title).toBe('C')
    expect(store.original.title).toBe('B')
    expect(store.isTouched('title')).toBe(true)
  })

  it('uses the server-normalized value as the new baseline', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.edit('title', '  B  ')
    store.reconcile({
      fields: ['title'],
      submitted: { title: '  B  ' },
      confirmed: { title: 'B' },
    })

    expect(store.title).toBe('B')
    expect(store.original.title).toBe('B')
    expect(store.isTouched('title')).toBe(false)
  })

  it('keeps newer input touched when a normalized response arrives', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.edit('title', 'B')
    store.edit('title', 'C')
    store.reconcile({
      fields: ['title'],
      submitted: { title: 'B' },
      confirmed: { title: 'B (normalized)' },
    })

    expect(store.title).toBe('C')
    expect(store.original.title).toBe('B (normalized)')
    expect(store.isTouched('title')).toBe(true)
  })

  it('rolls back a field group to its confirmed baseline', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.editMany({ title: 'B', desc: 'new' })
    expect(store.anyTouched(['title', 'desc'])).toBe(true)

    store.rollback(['title', 'desc'])

    expect(store.title).toBe('A')
    expect(store.desc).toBe('old')
    expect(store.anyTouched(['title', 'desc'])).toBe(false)
  })

  it('applies background confirmed data only to untouched fields', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.edit('title', 'local')
    store.reconcileConfirmed(fields('remote title', 'remote desc'))

    expect(store.title).toBe('local')
    expect(store.desc).toBe('remote desc')
    expect(store.original.title).toBe('remote title')
    expect(store.original.desc).toBe('remote desc')
    expect(store.isTouched('title')).toBe(true)
    expect(store.isTouched('desc')).toBe(false)
  })

  it('clears touched when background confirmed data matches the local edit', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.edit('title', 'shared')
    store.reconcileConfirmed(fields('shared', 'old'))

    expect(store.title).toBe('shared')
    expect(store.original.title).toBe('shared')
    expect(store.isTouched('title')).toBe(false)
  })
  it('keeps shell UI outside the editable field baseline', () => {
    const store = createDsbShellStore(fields('A', 'old'))

    store.ui.setSubmenuCollapsed(true)

    expect(store.ui.submenuCollapsed).toBe(true)
    expect(store.isTouched('title')).toBe(false)
    expect(store.original.title).toBe('A')
  })
  it('persists demo fields per community', () => {
    window.localStorage.clear()
    writeDemoFields('home', { contentShadow: true, title: 'Demo' })

    expect(readDemoFields('home')).toMatchObject({ contentShadow: true, title: 'Demo' })
    expect(readDemoFields('other')).toEqual({})
  })
})
