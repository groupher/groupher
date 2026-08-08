import type {
  TRichEditorTocItem,
  TRichEditorValidationDiagnostic,
} from '@groupher/rich-editor/node'

export type TArtimentBodyBag = {
  json: string
  markdown: string
  html: string
  toc: TRichEditorTocItem[]
  plainText: string
  digest: string
  bodyHash: string
  schemaVersion: number
}

export type TArtimentPublisherErrorCode =
  | 'backend_request_failed'
  | 'graphql_error'
  | 'invalid_json'
  | 'invalid_request'
  | 'invalid_value'
  | 'payload_too_large'
  | 'too_many_nodes'
  | 'unsupported_media_type'
  | 'value_too_deep'

export type TArtimentPublisherErrorPayload = {
  code: TArtimentPublisherErrorCode
  message: string
  diagnostics?: TRichEditorValidationDiagnostic[]
}
