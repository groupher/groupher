import { resolveWallpaperCommandId } from './requestCoordinator'

describe('resolveWallpaperCommandId', () => {
  it('reuses the pending key for the same fingerprint', () => {
    const pending = { fingerprint: 'same', commandId: 'old-command' }

    expect(
      resolveWallpaperCommandId({
        createKey: () => 'new-command',
        fingerprint: 'same',
        pending,
      }),
    ).toEqual(pending)
  })

  it('creates a new key when the fingerprint changes', () => {
    expect(
      resolveWallpaperCommandId({
        createKey: () => 'new-command',
        fingerprint: 'next',
        pending: { fingerprint: 'previous', commandId: 'old-command' },
      }),
    ).toEqual({ fingerprint: 'next', commandId: 'new-command' })
  })

  it('creates a key when no request is pending', () => {
    expect(
      resolveWallpaperCommandId({
        createKey: () => 'first-key',
        fingerprint: 'first',
        pending: null,
      }),
    ).toEqual({ fingerprint: 'first', commandId: 'first-key' })
  })
})
