/// <reference types="vite/client" />

interface Window {
  api: {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
  }
}
