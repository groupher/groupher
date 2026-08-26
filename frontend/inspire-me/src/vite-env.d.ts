/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_HUB_URL?: string
  readonly VITE_GIT_COMMIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
