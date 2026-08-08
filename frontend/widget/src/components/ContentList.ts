import { html, type TemplateResult } from 'lit'

import type { WidgetContentState, WidgetContentView, WidgetView } from '../app/state'

const VIEW_LABELS: Record<Exclude<WidgetView, 'home' | 'feedback'>, string> = {
  changelog: 'Changelog',
  docs: 'Docs',
  posts: 'Posts',
}

type ContentListProps = {
  view: WidgetContentView
  state: WidgetContentState
  onRetry: () => void
}

const formatMeta = (value?: string): string => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

const renderItemTitle = (title: string, link?: string): TemplateResult => {
  if (!link) {
    return html`<p class="text-sm font-medium text-slate-900">${title}</p>`
  }

  return html`
    <a
      class="block text-sm font-medium text-slate-900 hover:underline"
      href=${link}
      target="_blank"
      rel="noreferrer"
    >
      ${title}
    </a>
  `
}

const renderItemMeta = (value?: string): TemplateResult | null => {
  const formatted = formatMeta(value)
  return formatted ? html`<p class="mt-1 text-xs text-slate-400">${formatted}</p>` : null
}

/**
 * Render one content tab with loading, error, empty, and ready states.
 */
export const renderContentList = ({ view, state, onRetry }: ContentListProps): TemplateResult => {
  const label = VIEW_LABELS[view]

  if (state.status === 'loading') {
    return html`
      <section class="space-y-4" aria-labelledby="widget-content-title">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Content</p>
          <h2 id="widget-content-title" class="text-xl font-semibold text-balance text-slate-950">
            ${label}
          </h2>
        </div>
        <p class="text-sm text-slate-600">Loading ${label.toLowerCase()}…</p>
      </section>
    `
  }

  if (state.status === 'error') {
    return html`
      <section class="space-y-4" aria-labelledby="widget-content-title">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Content</p>
          <h2 id="widget-content-title" class="text-xl font-semibold text-balance text-slate-950">
            ${label}
          </h2>
        </div>
        <div class="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <p>${state.error ?? 'Unable to load this content.'}</p>
          <button
            class="mt-3 min-h-9 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
            type="button"
            @click=${onRetry}
          >
            Retry
          </button>
        </div>
      </section>
    `
  }

  if (!state.items.length || state.status === 'empty') {
    return html`
      <section class="space-y-4" aria-labelledby="widget-content-title">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Content</p>
          <h2 id="widget-content-title" class="text-xl font-semibold text-balance text-slate-950">
            ${label}
          </h2>
        </div>
        <p class="text-sm text-slate-600">No ${label.toLowerCase()} available yet.</p>
      </section>
    `
  }

  return html`
    <section class="space-y-4" aria-labelledby="widget-content-title">
      <div class="space-y-1">
        <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Content</p>
        <h2 id="widget-content-title" class="text-xl font-semibold text-balance text-slate-950">
          ${label}
        </h2>
      </div>
      <ul class="space-y-2">
        ${state.items.map(
          (item) => html`
            <li class="rounded-lg border border-slate-100 p-3">
              ${renderItemTitle(item.title, item.link)}
              ${
                item.digest ? html`<p class="mt-2 text-xs text-slate-600">${item.digest}</p>` : null
              }
              ${renderItemMeta(item.updatedAt)}
            </li>
          `,
        )}
      </ul>
    </section>
  `
}
