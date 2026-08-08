import { html, type TemplateResult } from 'lit'

import type { WidgetFeedbackState } from '../app/state'

type FeedbackViewProps = {
  state: WidgetFeedbackState
  onTitleChange: (value: string) => void
  onBodyChange: (value: string) => void
  onSubmit: () => void
}

/**
 * Render the v1 feedback form and its simulated submission states.
 */
export const renderFeedbackView = ({
  state,
  onTitleChange,
  onBodyChange,
  onSubmit,
}: FeedbackViewProps): TemplateResult => html`
  <section class="space-y-4" aria-labelledby="widget-feedback-title">
    <div class="space-y-1">
      <p class="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Feedback</p>
      <h2 id="widget-feedback-title" class="text-xl font-semibold text-balance text-slate-950">
        Share feedback
      </h2>
      <p class="text-sm leading-6 text-pretty text-slate-600">
        Submit title + body for a new feedback post.
      </p>
    </div>
    <form
      class="space-y-3"
      novalidate
      @submit=${(event: SubmitEvent) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label class="grid gap-2">
        <span class="text-xs font-medium tracking-wide text-slate-500 uppercase">Title</span>
        <input
          class="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          type="text"
          .value=${state.title}
          placeholder="Describe your issue in one sentence"
          @input=${(event: InputEvent) => onTitleChange((event.target as HTMLInputElement).value)}
          ?disabled=${state.status === 'submitting'}
          required
        />
      </label>
      <label class="grid gap-2">
        <span class="text-xs font-medium tracking-wide text-slate-500 uppercase">Body</span>
        <textarea
          class="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          .value=${state.body}
          placeholder="Add details"
          rows="4"
          @input=${(event: InputEvent) => onBodyChange((event.target as HTMLTextAreaElement).value)}
          ?disabled=${state.status === 'submitting'}
          required
        ></textarea>
      </label>
      ${state.status === 'error' ? html`<p class="text-sm text-rose-600">${state.error}</p>` : null}
      ${
        state.status === 'success'
          ? html`<p class="text-sm text-emerald-700">
              Submitted successfully.
              ${
                state.resultUrl
                  ? html`<a
                      class="underline"
                      href=${state.resultUrl}
                      target="_blank"
                      rel="noreferrer"
                      >Open post</a
                    >`
                  : null
              }
            </p>`
          : null
      }
      <button
        class="min-h-10 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        type="submit"
        ?disabled=${state.status === 'submitting'}
      >
        ${state.status === 'submitting' ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  </section>
`
