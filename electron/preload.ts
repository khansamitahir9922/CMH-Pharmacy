import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  /**
   * Invoke an IPC handler on the main process.
   * @param channel - IPC channel in 'module:action' format
   * @param args - Arguments to pass to the handler
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  }
})
