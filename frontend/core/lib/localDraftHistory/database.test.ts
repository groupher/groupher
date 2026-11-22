import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'

import { openLocalDraftDatabase, requestResult } from './database'

it('opens the new database while an old tab delays retirement, then deletes old storage', async () => {
  const oldName = 'groupher-local-draft-history'
  const old = await requestResult(indexedDB.open(oldName))
  const current = await openLocalDraftDatabase()

  expect(current?.name).toBe('groupher-local-draft-history-v2')
  old.close()
  // Wait behind the startup deletion request, then observe the catalog.
  await requestResult(indexedDB.deleteDatabase(oldName))
  expect((await indexedDB.databases()).some(({ name }) => name === oldName)).toBe(false)
  current?.close()
})
