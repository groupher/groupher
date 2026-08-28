import { describe, expect, it } from 'vitest'

import {
  isActiveCommunityRoute,
  isActiveDsbRoute,
  parseDsbPathname,
  resolveCommunityRoute,
  resolveDsbRoute,
  toDsbTargetFromPath,
} from './route'

describe('platform route parsing', () => {
  it('normalizes overview as empty segments', () => {
    expect(parseDsbPathname('/acme/overview')).toEqual({
      community: 'acme',
      segments: [],
    })
  })

  it('keeps normal Dash nested segments', () => {
    expect(parseDsbPathname('/acme/info/logos')).toEqual({
      community: 'acme',
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
    )
    const importTarget = toDsbTargetFromPath('/acme/doc/import?preview=job-1&job=j-1&unexpected=1')

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
    expect(isActiveDsbRoute('/acme', target)).toBe(true)
    expect(isActiveDsbRoute('/acme/overview', target)).toBe(true)
  })
})

describe('community route active', () => {
  const target = {
    app: 'community' as const,
    community: 'acme',
    path: 'post/42',
  }

  it('matches the exact target and its descendants', () => {
    expect(isActiveCommunityRoute('/acme/post/42', target)).toBe(true)
    expect(isActiveCommunityRoute('/acme/post/42/comments', target)).toBe(true)
  })

  it('does not match another community or a partial segment', () => {
    expect(isActiveCommunityRoute('/other/post/42', target)).toBe(false)
    expect(isActiveCommunityRoute('/acme/post/420', target)).toBe(false)
  })

  it('resolves a community route with its declared search schema', () => {
    expect(
      resolveCommunityRoute(
        {
          ...target,
          path: 'post',
          search: { tag: 'typescript', unexpected: 'drop' },
          searchSchema: ['tag'],
        },
        { currentSearch: 'tag=react&page=2', preserveSearch: true },
      ),
    ).toBe('/acme/post?tag=typescript')
  })
})
