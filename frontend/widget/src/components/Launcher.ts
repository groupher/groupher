import { html, type TemplateResult } from 'lit'

type LauncherProps = {
  open: boolean
  onToggle: () => void
}

/**
 * Render the persistent launcher that toggles the Widget panel.
 */
export const renderLauncher = ({ open, onToggle }: LauncherProps): TemplateResult => html`
  <button
    class="widget-launcher fixed right-6 bottom-6 grid size-12 place-items-center rounded-full bg-slate-950 text-white shadow-xl"
    type="button"
    aria-expanded=${String(open)}
    aria-label=${open ? 'Close Groupher Widget' : 'Open Groupher Widget'}
    @click=${onToggle}
  >
    <span class="widget-launcher__icon ${open ? 'widget-launcher__icon--visible' : ''}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 7 10 10M17 7 7 17" />
      </svg>
    </span>
    <span class="widget-launcher__icon ${open ? '' : 'widget-launcher__icon--visible'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7.5h12v8H9l-3 2.5V7.5Z" />
      </svg>
    </span>
  </button>
`
