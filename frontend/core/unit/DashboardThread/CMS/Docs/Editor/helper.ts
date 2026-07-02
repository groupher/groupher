import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import { send } from '~/lib/signal'

export const reloadDocPublishScope = (): void => {
  send(DSB_DOC_EVENT.PUBLISH_SCOPE_RELOAD)
}
