import { html, type TemplateResult } from 'lit'

import type { WidgetHomeState } from '../app/state'

/**
 * Render the Home summary for its current request state.
 */
export const renderHomeView = (state: WidgetHomeState): TemplateResult => {
  if (state.status === 'loading') {
    return html`
      <section class="space-y-4" aria-labelledby="widget-home-title">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Community</p>
          <h2 id="widget-home-title" class="text-xl font-semibold text-balance text-slate-950">
            Loading community overview
          </h2>
        </div>
        <p class="text-sm leading-6 text-slate-600">Fetching the latest Widget data...</p>
      </section>
    `
  }

  if (state.status === 'error') {
    return html`
      <section class="space-y-4" aria-labelledby="widget-home-title">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Community</p>
          <h2 id="widget-home-title" class="text-xl font-semibold text-balance text-slate-950">
            Failed to load
          </h2>
          <p class="text-sm leading-6 text-rose-600">
            ${state.error ?? 'Unable to load community data.'}
          </p>
        </div>
      </section>
    `
  }

  return html`
    <section class="space-y-4" aria-labelledby="widget-home-title">
      <div class="space-y-1">
        <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Community</p>
        <h2 id="widget-home-title" class="text-xl font-semibold text-balance text-slate-950">
          Surface is live
        </h2>
        <p class="text-sm leading-6 text-pretty text-slate-600">
          Browse the latest community activity from one compact panel.
        </p>
      </div>
      <div class="grid gap-2 rounded-xl bg-slate-50 p-4 shadow-sm">
        <p class="text-sm font-medium text-slate-900">
          Community data summary: ${state.posts + state.changelog + state.docs} total items
        </p>
        <div class="grid gap-1 text-sm text-slate-600">
          <p>Posts: ${state.posts}</p>
          <p>Changelog: ${state.changelog}</p>
          <p>Docs: ${state.docs}</p>
        </div>
      </div>
    </section>
  `
}
