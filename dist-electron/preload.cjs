"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  getInitialState: () => import_electron.ipcRenderer.invoke("get-initial-state"),
  onSyncState: (callback) => {
    import_electron.ipcRenderer.on("sync-state", (_event, state) => callback(state));
  }
});
