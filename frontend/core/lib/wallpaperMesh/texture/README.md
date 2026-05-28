# Wallpaper Texture Effects

Texture effects are split into two render paths:

- Canvas preview path: used for swatches, static preview dataURLs, and fallback/export helpers.
- WebGL wallpaper path: used by the live global wallpaper renderer.

The persisted descriptor is always:

```ts
type TWallpaperTexture = {
  type: TImageTextureType
  intensity: number
  params: Record<string, unknown>
}
```

`intensity` is the common strength slider. `params` is reserved for effect-specific controls.

## File Map

- `noise.ts`: deterministic fine-dot noise.
- `pixelate.ts`: blocky pixel sampling with cartoon palette compression.
- `screentone.ts`: halftone dots based on luminance.
- `ascii.ts`: luminance-sampled ASCII glyph field.
- `dither.ts`: ordered Bayer dithering.
- `index.ts`: Canvas dispatcher and preview/dataURL helpers.
- `shader.ts`: WebGL texture registry and shader snippets consumed by `wallpaperRenderer/webgl.ts`.

Global texture constants and UI options live one level up in `../constant.ts`.
Types in `../spec.d.ts` are derived from those constants.

## How It Works

Canvas previews call `renderTexture(ctx, source, width, height, texture, surface)`.

Each effect receives:

- `ctx`: the destination canvas context.
- `source`: the unmodified source canvas when the effect needs resampling.
- `width` / `height`: destination size.
- `intensity`: normalized 0-100 strength.
- `surface`: `wallpaper`, `preview`, or `swatch`, so effects can tune density for size.

The live WebGL path imports `TEXTURE_TYPE`, `TEXTURE_SHADER_HELPERS`, `TEXTURE_SHADER_UV`, and `TEXTURE_SHADER_BRANCHES` from `shader.ts`. `webgl.ts` owns runtime concerns such as canvas lifecycle, DPR, image upload, uniforms, and context restore. Texture files own effect-specific math.

## Add A New Texture

1. Add the type constant to `../constant.ts`:

   ```ts
   export const WALLPAPER_TEXTURE = {
     NOISE: 'noise',
     PIXELATE: 'pixelate',
     SCREENTONE: 'screentone',
     ASCII: 'ascii',
     DITHER: 'dither',
     LINEN: 'linen',
   } as const
   ```

2. Add the i18n-backed picker option to `../constant.ts`:

   ```ts
   {
     type: WALLPAPER_TEXTURE.LINEN,
     labelKey: 'dsb.appearance.wallpaper.texture.linen',
   }
   ```

3. Add the i18n text in `frontend/core/lib/i18n/en/dashboard.ts` and `zh/dashboard.ts`.

4. Create `linen.ts` with Canvas and WebGL pieces:

   ```ts
   export const LINEN_WEBGL_ID = 5

   export const LINEN_SHADER_BRANCH = `
     if (uTextureType == 5) {
       return color;
     }
   `

   export const renderLinenTexture = (
     ctx: CanvasRenderingContext2D,
     source: HTMLCanvasElement,
     width: number,
     height: number,
     intensity: number,
     surface: TTextureSurface,
   ): void => {
     ctx.drawImage(source, 0, 0, width, height)
   }
   ```

5. Register Canvas dispatch in `index.ts`.

6. Register the WebGL id and shader snippet in `shader.ts`.

7. Add the backend allowed value in:

   `backend/main/lib/groupher_server/cms/model/embeds/dashboard/wallpaper.ex`

8. Run:

   ```sh
   yarn workspace @groupher/frontend-core type-check
   yarn vitest --config frontend/core/vitest.config.mts run frontend/core/hooks/useWallpaper/index.test.tsx frontend/core/stores/wallpaper/tests/index.test.ts
   ```

## Debugging

- Picker option missing: check `../constant.ts` and callers of `WALLPAPER_TEXTURE_OPTIONS`.
- Swatch or static preview wrong: debug the Canvas renderer in the specific effect file.
- Global wallpaper wrong: debug the shader snippet in the specific effect file and `shader.ts` registration.
- Save fails: check backend `@texture_types`.
- Parameters ignored: `params` is persisted, but a new WebGL uniform must be added before shader code can consume it.

## Swatch Colors

Texture code does not own theme colors. `renderTextureSwatchDataUrl` requires a palette from the caller:

```ts
renderTextureSwatchDataUrl({
  texture,
  palette: {
    background: themeTokens.pageBg,
    mid: themeTokens.pageBg,
    edge: themeTokens.textDigest,
    digest: themeTokens.textTitle,
  },
})
```

Keep dark/light theme decisions in UI/theme code, not in texture algorithms.
