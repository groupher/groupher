import type { GroupherWidgetApi, WidgetLoaderState } from './loader/commandQueue'

declare global {
  const __WIDGET_RUNTIME_ASSET_PATH__: string

  interface Window {
    GroupherWidget?: GroupherWidgetApi
    __groupherWidgetLoaderState?: WidgetLoaderState
    __groupherWidgetCreateRuntime?: () => import('./loader/commandQueue').WidgetRuntime
    __groupherWidgetRuntimeBaseUrl?: string
  }
}

export {}
