import { LitElement, html, type PropertyValues } from 'lit'

import { fetchContentData, fetchHomeData, submitFeedback } from '../api/client'
import {
  createDefaultWidgetState,
  type WidgetBootConfig,
  type WidgetContentView,
  type WidgetContentState,
  type WidgetContentItem,
  type WidgetFeedbackState,
  type WidgetPageContext,
  type WidgetState,
  type WidgetView,
  WidgetListStatus,
  resolveCommunityFromWidgetKey,
} from '../app/state'
import { renderLauncher } from '../components/Launcher'
import { renderPanel } from '../components/Panel'

import widgetStyles from '../styles.css?inline'

const FALLBACK_COMMUNITY = 'groupher'
const DEFAULT_MOCK_DELAY_MS = 700

const initialRequestState = (): WidgetContentState => ({ status: 'idle', items: [] })

const getMockDelay = (): number =>
  DEFAULT_MOCK_DELAY_MS + Math.floor(Math.random() * DEFAULT_MOCK_DELAY_MS * 0.4)

const createMockItems = (prefix: string): WidgetContentItem[] => [
  {
    id: `${prefix}-1`,
    title: `${prefix} item A`,
    digest: '模拟条目：展示真实加载后的内容形态。',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: `${prefix}-2`,
    title: `${prefix} item B`,
    digest: '这是给 v1 体验准备的 mock 数据，不接入真实 API。',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: `${prefix}-3`,
    title: `${prefix} item C`,
    digest: '用于确认切换 Tab/重试等交互行为。',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
]

export const GROUPHER_WIDGET_TAG = 'groupher-widget'

/**
 * Own the Widget Shadow DOM, state machine, and public runtime lifecycle.
 */
export class GroupherWidgetElement extends LitElement {
  static properties = {
    widgetState: { attribute: false, state: true },
  }

  declare private widgetState: WidgetState

  private homeRequestId = 0
  private homeAbortController: AbortController | null = null
  private feedbackRequestId = 0
  private feedbackAbortController: AbortController | null = null
  private contentRequestIds = {
    posts: 0,
    changelog: 0,
    docs: 0,
  }
  private contentAbortControllers: Record<WidgetContentView, AbortController | null> = {
    posts: null,
    changelog: null,
    docs: null,
  }

  constructor() {
    super()
    this.widgetState = createDefaultWidgetState()
  }

  protected createRenderRoot(): ShadowRoot {
    const root = super.createRenderRoot() as ShadowRoot
    const style = document.createElement('style')
    style.dataset.groupherWidgetStyles = ''
    style.textContent = widgetStyles
    root.append(style)
    return root
  }

  protected updated(changed: PropertyValues): void {
    if (!changed.has('widgetState')) return
    this.dataset.open = String(this.widgetState.open)
    this.dataset.view = this.widgetState.view
  }

  private get runtimeBaseUrl(): string {
    return window.__groupherWidgetLoaderState?.runtimeBaseUrl || `${window.location.origin}/`
  }

  private cleanupRequests(): void {
    this.homeRequestId += 1
    this.feedbackRequestId += 1
    this.homeAbortController?.abort()
    this.homeAbortController = null
    this.feedbackAbortController?.abort()
    this.feedbackAbortController = null
    ;(Object.keys(this.contentAbortControllers) as WidgetContentView[]).forEach((view) => {
      this.contentRequestIds[view] += 1
      this.contentAbortControllers[view]?.abort()
      this.contentAbortControllers[view] = null
    })
  }

  private resolveCommunity(): string {
    return resolveCommunityFromWidgetKey(this.widgetState.config.widgetKey) || FALLBACK_COMMUNITY
  }

  private getMockHomeData(): { posts: number; changelog: number; docs: number } {
    return {
      posts: 14,
      changelog: 6,
      docs: 9,
    }
  }

  private getMockContent(view: WidgetContentView): WidgetContentItem[] {
    if (view === 'posts') return createMockItems('Posts')
    if (view === 'changelog') return createMockItems('Changelog')
    return createMockItems('Docs')
  }

  private get isMock(): boolean {
    return this.widgetState.config.mock === true
  }

  private waitForMock(ms: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (!signal) {
        window.setTimeout(() => resolve(true), ms)
        return
      }

      if (signal.aborted) {
        resolve(false)
        return
      }

      const timeout = window.setTimeout(() => {
        cleanup()
        resolve(true)
      }, ms)

      const cleanup = (): void => {
        window.clearTimeout(timeout)
        signal.removeEventListener('abort', onAbort)
      }

      const onAbort = (): void => {
        cleanup()
        resolve(false)
      }

      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  private updateContentState(view: WidgetContentView, updates: Partial<WidgetContentState>): void {
    if (view === 'posts') {
      this.widgetState = {
        ...this.widgetState,
        posts: {
          ...this.widgetState.posts,
          ...updates,
          items: updates.items ?? this.widgetState.posts.items,
        },
      }
      return
    }

    if (view === 'changelog') {
      this.widgetState = {
        ...this.widgetState,
        changelog: {
          ...this.widgetState.changelog,
          ...updates,
          items: updates.items ?? this.widgetState.changelog.items,
        },
      }
      return
    }

    this.widgetState = {
      ...this.widgetState,
      docs: {
        ...this.widgetState.docs,
        ...updates,
        items: updates.items ?? this.widgetState.docs.items,
      },
    }
  }

  private setStatus(view: WidgetContentView, status: WidgetListStatus): void {
    this.updateContentState(view, {
      status,
      error: undefined,
      items: status === 'loading' ? [] : undefined,
    })
  }

  private async loadHome(force = false): Promise<void> {
    if (
      !force &&
      (this.widgetState.home.status === 'loading' || this.widgetState.home.status === 'ready')
    ) {
      return
    }

    const requestId = ++this.homeRequestId
    const community = this.resolveCommunity()
    this.homeAbortController?.abort()
    this.homeAbortController = new AbortController()
    this.widgetState = {
      ...this.widgetState,
      home: {
        ...this.widgetState.home,
        status: 'loading',
        error: undefined,
      },
    }

    if (this.isMock) {
      const shouldContinue = await this.waitForMock(getMockDelay(), this.homeAbortController.signal)

      if (!shouldContinue || requestId !== this.homeRequestId || !this.isConnected) return

      const mock = this.getMockHomeData()
      this.widgetState = {
        ...this.widgetState,
        community,
        home: {
          status: 'ready',
          posts: mock.posts,
          changelog: mock.changelog,
          docs: mock.docs,
        },
        posts:
          this.widgetState.posts.status === 'idle' ? initialRequestState() : this.widgetState.posts,
        changelog:
          this.widgetState.changelog.status === 'idle'
            ? initialRequestState()
            : this.widgetState.changelog,
        docs:
          this.widgetState.docs.status === 'idle' ? initialRequestState() : this.widgetState.docs,
      }
      return
    }

    const response = await fetchHomeData({
      baseUrl: this.runtimeBaseUrl,
      widgetKey: this.widgetState.config.widgetKey,
      community,
      signal: this.homeAbortController.signal,
    })

    if (requestId !== this.homeRequestId || !this.isConnected) return

    if (!response.ok) {
      this.widgetState = {
        ...this.widgetState,
        home: {
          status: 'error',
          posts: 0,
          changelog: 0,
          docs: 0,
          error: response.error,
        },
      }
      return
    }

    this.widgetState = {
      ...this.widgetState,
      community,
      home: {
        status: 'ready',
        posts: response.data.counts.posts,
        changelog: response.data.counts.changelog,
        docs: response.data.counts.docs,
      },
      posts:
        this.widgetState.posts.status === 'idle' ? initialRequestState() : this.widgetState.posts,
      changelog:
        this.widgetState.changelog.status === 'idle'
          ? initialRequestState()
          : this.widgetState.changelog,
      docs: this.widgetState.docs.status === 'idle' ? initialRequestState() : this.widgetState.docs,
    }
  }

  private async loadContent(view: WidgetContentView, force = false): Promise<void> {
    const currentState =
      view === 'posts'
        ? this.widgetState.posts
        : view === 'changelog'
          ? this.widgetState.changelog
          : this.widgetState.docs

    if (!force && (currentState.status === 'loading' || currentState.status === 'ready')) return

    const requestId = ++this.contentRequestIds[view]
    this.contentAbortControllers[view]?.abort()
    this.contentAbortControllers[view] = new AbortController()
    this.setStatus(view, 'loading')

    if (this.isMock) {
      const shouldContinue = await this.waitForMock(
        getMockDelay(),
        this.contentAbortControllers[view]!.signal,
      )

      if (!shouldContinue || requestId !== this.contentRequestIds[view] || !this.isConnected) return

      const mockItems = this.getMockContent(view)
      this.updateContentState(view, {
        status: mockItems.length === 0 ? 'empty' : 'ready',
        items: mockItems,
        error: undefined,
      })
      return
    }

    const response = await fetchContentData({
      baseUrl: this.runtimeBaseUrl,
      widgetKey: this.widgetState.config.widgetKey,
      community: this.resolveCommunity(),
      view,
      limit: 5,
      signal: this.contentAbortControllers[view]!.signal,
    })

    if (requestId !== this.contentRequestIds[view] || !this.isConnected) return

    if (!response.ok) {
      this.updateContentState(view, { status: 'error', error: response.error })
      return
    }

    this.updateContentState(view, {
      status: response.data.items.length === 0 ? 'empty' : 'ready',
      items: response.data.items,
      error: undefined,
    })
  }

  private async loadByView(view: WidgetView): Promise<void> {
    if (view === 'home') {
      await this.loadHome()
      return
    }

    if (view === 'feedback') {
      return
    }

    await this.loadContent(view)
  }

  private async onSubmitFeedback(): Promise<void> {
    if (this.widgetState.feedback.status === 'submitting') return

    const title = this.widgetState.feedback.title.trim()
    const body = this.widgetState.feedback.body.trim()

    if (!title || !body) {
      this.widgetState = {
        ...this.widgetState,
        feedback: {
          ...this.widgetState.feedback,
          status: 'error',
          error: '请先填写标题和内容。',
        },
      }
      return
    }

    this.widgetState = {
      ...this.widgetState,
      feedback: {
        ...this.widgetState.feedback,
        status: 'submitting',
        error: undefined,
      },
    }

    const requestId = ++this.feedbackRequestId
    this.feedbackAbortController?.abort()
    this.feedbackAbortController = new AbortController()

    if (this.isMock) {
      const shouldContinue = await this.waitForMock(
        800 + Math.random() * 500,
        this.feedbackAbortController.signal,
      )
      if (!shouldContinue || requestId !== this.feedbackRequestId || !this.isConnected) return

      this.widgetState = {
        ...this.widgetState,
        feedback: {
          ...this.widgetState.feedback,
          status: 'success',
          title: '',
          body: '',
          resultUrl: undefined,
        },
      }
      return
    }

    const response = await submitFeedback({
      baseUrl: this.runtimeBaseUrl,
      widgetKey: this.widgetState.config.widgetKey,
      community: this.resolveCommunity(),
      title,
      body,
      context: this.widgetState.context,
      signal: this.feedbackAbortController.signal,
    })

    if (requestId !== this.feedbackRequestId || !this.isConnected) return

    if (!response.ok) {
      this.widgetState = {
        ...this.widgetState,
        feedback: {
          ...this.widgetState.feedback,
          status: 'error',
          error: response.error,
        },
      }
      return
    }

    this.widgetState = {
      ...this.widgetState,
      feedback: {
        ...this.widgetState.feedback,
        status: 'success',
        title: '',
        body: '',
        resultUrl: response.data.result.link,
      },
    }
  }

  boot(config: WidgetBootConfig): void {
    const community = resolveCommunityFromWidgetKey(config.widgetKey) || FALLBACK_COMMUNITY
    const shouldResetData =
      this.widgetState.config.widgetKey !== config.widgetKey ||
      this.widgetState.config.mock !== config.mock

    if (shouldResetData) {
      const { context, open, view } = this.widgetState
      this.cleanupRequests()
      this.widgetState = {
        ...createDefaultWidgetState(config),
        community,
        context,
        open,
        view,
      }

      if (open) {
        void this.loadByView(view)
      }
      return
    }

    this.widgetState = {
      ...this.widgetState,
      config,
      community,
    }
  }

  open(view?: WidgetView): void {
    const targetView = view ?? this.widgetState.view

    this.widgetState = {
      ...this.widgetState,
      open: true,
      view: targetView,
    }

    void this.loadByView(targetView)
  }

  close(): void {
    this.widgetState = { ...this.widgetState, open: false }
  }

  toggle(): void {
    const next = !this.widgetState.open
    this.widgetState = { ...this.widgetState, open: next }

    if (next) {
      void this.loadByView(this.widgetState.view)
    }
  }

  dispose(): void {
    this.cleanupRequests()
    this.remove()
  }

  updateContext(context: WidgetPageContext): void {
    this.widgetState = {
      ...this.widgetState,
      context: { ...this.widgetState.context, ...context },
    }
  }

  disconnectedCallback(): void {
    this.cleanupRequests()
    super.disconnectedCallback()
  }

  protected render() {
    const positionClass = this.widgetState.config.position === 'bottom-left' ? 'widget-left' : ''

    return html`
      <div class=${positionClass}>
        ${renderPanel({
          onViewChange: (view) => this.open(view),
          open: this.widgetState.open,
          view: this.widgetState.view,
          home: this.widgetState.home,
          posts: this.widgetState.posts,
          changelog: this.widgetState.changelog,
          docs: this.widgetState.docs,
          feedback: this.widgetState.feedback,
          onTitleChange: (title: string) => {
            if (this.widgetState.feedback.status === 'submitting') return
            this.widgetState = {
              ...this.widgetState,
              feedback: {
                ...this.widgetState.feedback,
                title,
                status: 'idle',
                error: undefined,
                resultUrl: undefined,
              },
            }
          },
          onBodyChange: (body: string) => {
            if (this.widgetState.feedback.status === 'submitting') return
            this.widgetState = {
              ...this.widgetState,
              feedback: {
                ...this.widgetState.feedback,
                body,
                status: 'idle',
                error: undefined,
                resultUrl: undefined,
              },
            }
          },
          onSubmitFeedback: () => void this.onSubmitFeedback(),
          onRetry: (view) => void this.loadContent(view, true),
        })}
        ${renderLauncher({ open: this.widgetState.open, onToggle: () => this.toggle() })}
      </div>
    `
  }
}

/**
 * Register the custom element once for idempotent loader execution.
 */
export const defineGroupherWidget = (): void => {
  if (!customElements.get(GROUPHER_WIDGET_TAG)) {
    customElements.define(GROUPHER_WIDGET_TAG, GroupherWidgetElement)
  }
}
