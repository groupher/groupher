import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import { send } from '~/lib/signal'

/** Runs the reload doc publish checklist operation at the frontend shared boundary. */
export const reloadDocsPublishQueue = (): void => {
  send(DSB_DOC_EVENT.PUBLISH_QUEUE_RELOAD)
}
