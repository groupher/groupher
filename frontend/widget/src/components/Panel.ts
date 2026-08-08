import { html, type TemplateResult } from 'lit'

import {
  type WidgetContentView,
  type WidgetContentState,
  type WidgetFeedbackState,
  type WidgetHomeState,
  type WidgetView,
  WIDGET_VIEWS,
} from '../app/state'
import { renderContentList } from './ContentList'
import { renderFeedbackView } from './FeedbackView'
import { renderHomeView } from './HomeView'

type PanelProps = {
  onViewChange: (view: WidgetView) => void
  open: boolean
  view: WidgetView
  home: WidgetHomeState
  posts: WidgetContentState
  changelog: WidgetContentState
  docs: WidgetContentState
  feedback: WidgetFeedbackState
  onTitleChange: (title: string) => void
  onBodyChange: (body: string) => void
  onSubmitFeedback: () => void
  onRetry: (view: WidgetContentView) => void
}

type RenderViewParams = {
  renderView: WidgetView
  home: WidgetHomeState
  posts: WidgetContentState
  changelog: WidgetContentState
  docs: WidgetContentState
  feedback: WidgetFeedbackState
  onTitleChange: (title: string) => void
  onBodyChange: (body: string) => void
  onSubmitFeedback: () => void
  onRetry: (view: WidgetContentView) => void
}

const VIEW_LABELS: Record<WidgetView, string> = {
  changelog: 'Changelog',
  docs: 'Docs',
  feedback: 'Feedback',
  home: 'Home',
  posts: 'Posts',
}

const getContentState = (
  posts: WidgetContentState,
  changelog: WidgetContentState,
  docs: WidgetContentState,
  view: WidgetContentView,
): WidgetContentState => {
  if (view === 'posts') return posts
  if (view === 'changelog') return changelog
  return docs
}

const renderView = ({
  renderView: view,
  home,
  feedback,
  posts,
  changelog,
  docs,
  onTitleChange,
  onBodyChange,
  onSubmitFeedback,
  onRetry,
}: RenderViewParams): TemplateResult => {
  if (view === 'home') {
    return renderHomeView(home)
  }

  if (view === 'feedback') {
    return renderFeedbackView({
      state: feedback,
      onTitleChange,
      onBodyChange,
      onSubmit: onSubmitFeedback,
    })
  }

  return renderContentList({
    view,
    state: getContentState(posts, changelog, docs, view),
    onRetry: () => onRetry(view),
  })
}

/**
 * Render the responsive Widget panel and route the active view to its renderer.
 */
export const renderPanel = ({
  onViewChange,
  open,
  view,
  home,
  posts,
  changelog,
  docs,
  feedback,
  onTitleChange,
  onBodyChange,
  onSubmitFeedback,
  onRetry,
}: PanelProps): TemplateResult => html`
  <aside
    class="widget-panel ${open ? 'widget-panel--open' : 'widget-panel--closed'} fixed right-6 bottom-20 overflow-hidden rounded-3xl bg-white shadow-2xl"
    aria-hidden=${String(!open)}
    aria-label="Groupher Widget"
  >
    <header class="flex items-center justify-between px-5 py-4">
      <div>
        <p class="text-sm font-semibold text-slate-950">Groupher Widget</p>
        <p class="text-xs text-slate-500">Community, where you need it</p>
      </div>
      <span class="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700"
        >v1</span
      >
    </header>
    <nav class="flex gap-1 overflow-x-auto border-y border-slate-100 px-3 py-2" aria-label="Views">
      ${WIDGET_VIEWS.map(
        (item) => html`
          <button
            class="${item === view ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'} min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold"
            type="button"
            aria-current=${item === view ? 'page' : 'false'}
            @click=${() => onViewChange(item)}
          >
            ${VIEW_LABELS[item]}
          </button>
        `,
      )}
    </nav>
    <main class="widget-panel__content overflow-y-auto p-5">
      ${renderView({
        renderView: view,
        home,
        posts,
        changelog,
        docs,
        feedback,
        onTitleChange,
        onBodyChange,
        onSubmitFeedback,
        onRetry,
      })}
    </main>
  </aside>
`
