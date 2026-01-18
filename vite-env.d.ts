/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_SERVER_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
