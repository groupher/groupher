/**
 * Implements the Src Cache boundary inside Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

import { eq, like } from 'drizzle-orm'

import type { PressDatabase } from './db/client'
import { pressOutputCache } from './db/schema'

export type CachedOutput = {
  status: number
  body: string
  headers: Record<string, string>
  metadata?: Record<string, string>
  expiresAt: Date
}

export type OutputCache = {
  get(key: string): Promise<CachedOutput | null>
  set(key: string, value: CachedOutput): Promise<void>
  invalidate(prefix: string): Promise<void>
}

/** Creates output cache from typed press inputs. */
export const createOutputCache = (db: PressDatabase | null): OutputCache => {
  return {
    async get(key) {
      if (!db) return null
      const [row] = await db
        .select()
        .from(pressOutputCache)
        .where(eq(pressOutputCache.key, key))
        .limit(1)
      if (!row || row.expiresAt <= new Date()) return null
      const value = {
        status: row.status,
        body: row.body,
        headers: row.headers,
        metadata: row.metadata || undefined,
        expiresAt: row.expiresAt,
      }
      return value
    },
    async set(key, value) {
      if (!db) return
      await db
        .insert(pressOutputCache)
        .values({ key, ...value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: pressOutputCache.key,
          set: { ...value, updatedAt: new Date() },
        })
    },
    async invalidate(prefix) {
      if (!db) return
      await db.delete(pressOutputCache).where(like(pressOutputCache.key, `${prefix}%`))
    },
  }
}
