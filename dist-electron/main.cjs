"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var path = __toESM(require("path"), 1);
var import_ws = require("ws");
var fs = __toESM(require("fs"), 1);
var import_child_process = require("child_process");
var renderWindow = null;
var tray = null;
var wss = null;
var latestState = null;
var latestFrame = null;
var captureTimeout = null;
var clockTimer = null;
var isDev = !import_electron.app.isPackaged;
var WS_PORT = 34567;
var userDir = import_electron.app.getPath("userData");
var STORE_FILE = path.join(userDir, "walltask-state.json");
var WALLPAPER_FILE = path.join(userDir, "walltask-wallpaper.png");
var WP_SCRIPT_FILE = path.join(userDir, "set-wallpaper.ps1");
function loadState() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      latestState = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
    }
  } catch {
  }
}
function saveState(state) {
  latestState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state));
  } catch {
  }
}
function applyWallpaper() {
  const wp = WALLPAPER_FILE.replace(/\//g, "\\\\");
  const script = [
    'Add-Type @"',
    "using System;using System.Runtime.InteropServices;",
    "public class W{",
    '  [DllImport("user32.dll",CharSet=CharSet.Auto)]',
    "  static extern int SystemParametersInfo(int a,int b,string c,int d);",
    "  public static void Set(string p){SystemParametersInfo(0x0014,0,p,3);}",
    "}",
    '"@',
    `[W]::Set("${wp}")`
  ].join("\n");
  try {
    fs.writeFileSync(WP_SCRIPT_FILE, script, "utf-8");
    (0, import_child_process.execFile)(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", WP_SCRIPT_FILE],
      (err) => {
        if (err) console.error("[wallpaper]", err.message);
      }
    );
  } catch (e) {
    console.error("[wallpaper] script write failed", e.message);
  }
}
function scheduleCapture() {
  if (captureTimeout) clearTimeout(captureTimeout);
  captureTimeout = setTimeout(async () => {
    if (!renderWindow || renderWindow.isDestroyed()) return;
    renderWindow.webContents.send("sync-state", latestState);
    renderWindow.webContents.invalidate();
    await new Promise((r) => setTimeout(r, 1500));
    if (latestFrame && !latestFrame.isEmpty()) {
      try {
        fs.writeFileSync(WALLPAPER_FILE, latestFrame.toPNG());
        applyWallpaper();
        console.log("[wallpaper] updated successfully");
      } catch (e) {
        console.error("[capture]", e.message);
      }
    }
  }, 800);
}
function startWS() {
  try {
    wss = new import_ws.WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });
  } catch (e) {
    console.error("[ws] failed to create server", e.message);
    return;
  }
  wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[ws] Port ${WS_PORT} busy, retrying in 3s\u2026`);
      setTimeout(() => {
        try {
          wss?.close();
        } catch {
        }
        startWS();
      }, 3e3);
    }
  });
  wss.on("connection", (ws) => {
    console.log("[ws] browser client connected");
    if (latestState) {
      ws.send(JSON.stringify({ type: "SYNC_STATE", state: latestState }));
    }
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "SYNC_STATE" && msg.state) {
          saveState(msg.state);
          scheduleCapture();
        }
      } catch {
      }
    });
  });
  console.log(`[ws] server listening on ws://127.0.0.1:${WS_PORT}`);
}
function createRenderWindow() {
  const { width, height } = import_electron.screen.getPrimaryDisplay().size;
  renderWindow = new import_electron.BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      offscreen: true,
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  renderWindow.webContents.setFrameRate(1);
  renderWindow.webContents.on("paint", (_e, _dirty, image) => {
    latestFrame = image;
  });
  const url = isDev ? "http://localhost:3001" : `file://${path.join(__dirname, "../renderer/index.html").replace(/\\/g, "/")}`;
  renderWindow.loadURL(url);
  renderWindow.webContents.on("did-finish-load", () => {
    console.log("[render] page loaded, scheduling initial capture\u2026");
    setTimeout(() => scheduleCapture(), 3e3);
  });
  renderWindow.on("closed", () => {
    renderWindow = null;
  });
}
function createTray() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - 7.5, cy = y - 7.5;
      const d = Math.sqrt(cx * cx + cy * cy);
      if (d < 6.5) {
        const edge = Math.max(0, 1 - Math.max(0, d - 5.5));
        buf[i] = 160;
        buf[i + 1] = 100;
        buf[i + 2] = 255;
        buf[i + 3] = Math.round(edge * 255);
      }
    }
  }
  const icon = import_electron.nativeImage.createFromBuffer(buf, { width: size, height: size });
  tray = new import_electron.Tray(icon);
  tray.setToolTip("WallTask Companion \u2014 Live Wallpaper Sync");
  const menu = import_electron.Menu.buildFromTemplate([
    { label: "Refresh Wallpaper Now", click: () => scheduleCapture() },
    { type: "separator" },
    { label: "Open WallTask Settings", click: () => openSettings() },
    { type: "separator" },
    { label: "Quit WallTask Companion", click: () => import_electron.app.quit() }
  ]);
  tray.setContextMenu(menu);
}
var settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new import_electron.BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    title: "WallTask Companion \u2014 Settings",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  const url = isDev ? "http://localhost:8081/wallpaper" : "https://walltask.vercel.app/wallpaper";
  settingsWin.loadURL(url);
  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}
var gotLock = import_electron.app.requestSingleInstanceLock();
if (!gotLock) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", () => openSettings());
  import_electron.app.whenReady().then(() => {
    if (!isDev) {
      try {
        import_electron.app.setLoginItemSettings({ openAtLogin: true, path: import_electron.app.getPath("exe") });
      } catch {
      }
    }
    loadState();
    startWS();
    createRenderWindow();
    createTray();
    import_electron.ipcMain.handle("get-initial-state", () => latestState);
    clockTimer = setInterval(() => scheduleCapture(), 6e4);
    console.log("[boot] WallTask Companion started successfully");
  });
}
import_electron.app.on("window-all-closed", () => {
});
