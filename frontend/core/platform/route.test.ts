import { describe, expect, it } from 'vitest'

import { isActiveDsbRoute, parseDsbPathname, resolveDsbRoute, toDsbTargetFromPath } from './route'

describe('platform route parsing', () => {
  it('normalizes overview as empty segments', () => {
    expect(parseDsbPathname('/acme/overview', 'dash')).toEqual({
      community: 'acme',
      rootSegment: 'dash',
      segments: [],
    })
  })

  it('keeps normal Dash nested segments', () => {
    expect(parseDsbPathname('/acme/info/logos', 'dash')).toEqual({
      community: 'acme',
      rootSegment: 'dash',
      segments: ['info', 'logos'],
    })
  })
})

describe('platform route search', () => {
  it('keeps allowed keys and overrides with explicit target search', () => {
    const target = {
      app: 'dsb' as const,
      community: 'acme',
      path: 'post/content',
      search: {
        page: '6',
        tab: 'published',
        mode: 'dark',
        other: 'keep',
        unexpected: 'nope',
      },
    }
    const next = resolveDsbRoute(target, {
      rootSegment: 'dash',
      currentSearch: 'page=2&tab=draft&tag=tech&unexpected=oops',
      preserveSearch: true,
    })
    expect(next.startsWith('/acme/post/content')).toBe(true)
    const nextSearch = new URL(next, 'https://dash.groupher.localhost').searchParams

    expect(nextSearch.get('page')).toBe('6')
    expect(nextSearch.get('tab')).toBe('published')
    expect(nextSearch.get('tag')).toBe('tech')
    expect(nextSearch.get('mode')).toBe('dark')
    expect(nextSearch.get('other')).toBe('keep')
    expect(nextSearch.get('unexpected')).toBeNull()
  })

  it('keeps doc editor and import allowlist keys, drops unknown keys', () => {
    const editorTarget = toDsbTargetFromPath(
      '/acme/doc/editor?docId=x&preview=job-1&job=j-1&unexpected=1',
      'dash',
    )
    const importTarget = toDsbTargetFromPath(
      '/acme/doc/import?preview=job-1&job=j-1&unexpected=1',
      'dash',
    )

    expect(editorTarget).toMatchObject({
      app: 'dsb',
      community: 'acme',
      path: 'doc/editor',
      search: {
        docId: 'x',
      },
    })
    expect(editorTarget?.search.job).toBeUndefined()
    expect(editorTarget?.search.unexpected).toBeUndefined()

    expect(importTarget).toMatchObject({
      app: 'dsb',
      community: 'acme',
      path: 'doc/import',
      search: {
        job: 'j-1',
        preview: 'job-1',
      },
    })
    expect(importTarget?.search.docId).toBeUndefined()
    expect(importTarget?.search.unexpected).toBeUndefined()
  })

  it('honors an explicit target schema and removes preserved nullish values', () => {
    const next = resolveDsbRoute(
      {
        app: 'dsb',
        community: 'acme',
        path: 'custom',
        search: { page: null, scope: 'members', unexpected: 'nope' },
        searchSchema: ['scope'],
      },
      {
        rootSegment: 'dash',
        currentSearch: 'page=2&scope=all&unexpected=keep',
        preserveSearch: true,
      },
    )
    expect(next.startsWith('/acme/custom')).toBe(true)
    const nextSearch = new URL(next, 'https://dash.groupher.localhost').searchParams

    expect(nextSearch.get('page')).toBeNull()
    expect(nextSearch.get('scope')).toBe('members')
    expect(nextSearch.get('unexpected')).toBeNull()
  })
})

describe('platform route active', () => {
  it('marks overview target as active on overview pathname', () => {
    const target = {
      app: 'dsb' as const,
      community: 'acme',
      path: '',
    }
    expect(isActiveDsbRoute('/acme', target, 'dash')).toBe(true)
    expect(isActiveDsbRoute('/acme/overview', target, 'dash')).toBe(true)
  })
})
