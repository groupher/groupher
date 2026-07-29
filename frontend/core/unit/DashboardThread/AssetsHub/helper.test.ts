import { describe, expect, test } from 'vitest'

import {
  assetPublicReadUrl,
  assetUploaderName,
  formatAssetDimensions,
  formatAssetRefMeta,
  formatAssetRefTitle,
  isPreviewableImage,
} from './helper'
import type { TAsset, TAssetRef } from './spec'

describe('AssetsHub helper', () => {
  test('detects previewable image assets from type or mime', () => {
    expect(isPreviewableImage({ assetType: 'IMAGE', id: 'asset-1' })).toBe(true)
    expect(isPreviewableImage({ id: 'asset-2', mimeType: 'image/webp' })).toBe(true)
    expect(
      isPreviewableImage({ assetType: 'FILE', id: 'asset-3', mimeType: 'application/pdf' }),
    ).toBe(false)
  })

  test('guards public read URL when publicRef is missing', () => {
    expect(assetPublicReadUrl({ id: 'asset-1' })).toBe('')
    expect(assetPublicReadUrl({ id: 'asset-2', publicRef: 'asset_public' })).toContain(
      '/a/asset_public/original',
    )
  })

  test('formats dimensions and reference labels', () => {
    const asset: TAsset = { height: 480, id: 'asset-1', width: 640 }
    const ref: TAssetRef = {
      articleId: '42',
      blockId: 'hero',
      blockType: 'image',
      id: 'ref-1',
      source: 'editor',
      thread: 'POST',
      usage: 'INLINE',
    }

    expect(formatAssetDimensions(asset)).toBe('640 x 480')
    expect(formatAssetRefTitle(ref)).toBe('POST #42')
    expect(formatAssetRefMeta(ref)).toContain('INLINE')
    expect(formatAssetRefMeta(ref)).toContain('block hero')
  })

  test('formats uploader name with stable fallback', () => {
    expect(assetUploaderName({ id: 'asset-1', uploader: { login: 'rishi' } })).toBe('rishi')
    expect(
      assetUploaderName({ id: 'asset-2', uploader: { login: 'rishi', nickname: 'Rishi' } }),
    ).toBe('Rishi')
    expect(assetUploaderName({ id: 'asset-3' })).toBe('unknown')
  })
})
