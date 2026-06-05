import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getInitialState: () => ipcRenderer.invoke("get-initial-state"),
  onSyncState: (callback: (state: any) => void) => {
    ipcRenderer.on("sync-state", (_event, state) => callback(state));
  },
});
