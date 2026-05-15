/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SOCKET_URL: string
  readonly VITE_UNIVERSITY_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
