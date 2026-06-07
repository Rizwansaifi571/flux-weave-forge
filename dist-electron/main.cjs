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
var captureInProgress = false;
var connectedClients = 0;
var renderWindow = null;
var tray = null;
var wss = null;
var latestState = null;
var latestFrame = null;
var captureTimeout = null;
var clockTimer = null;
var latestOrigin = null;
var isDev = !import_electron.app.isPackaged;
var WS_PORT = 34567;
var userDir = import_electron.app.getPath("userData");
var STORE_FILE = path.join(userDir, "walltask-state.json");
var WALLPAPER_FILE = path.join(userDir, "walltask-wallpaper.png");
var WP_SCRIPT_FILE = path.join(userDir, "set-wallpaper.ps1");
function getRendererIndexPath() {
  return path.join(__dirname, "renderer", "index.html");
}
function loadState() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      latestState = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
    }
  } catch {
    latestState = null;
  }
}
function saveState(state) {
  latestState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("[state] save failed", err);
  }
}
function broadcastState(state) {
  if (!wss) return;
  const payload = JSON.stringify({ type: "SYNC_STATE", state });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}
function applyWallpaper() {
  const wp = WALLPAPER_FILE.replace(/\//g, "\\");
  const script = [
    'Add-Type @"',
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class W {",
    '  [DllImport("user32.dll", CharSet = CharSet.Auto)]',
    "  static extern int SystemParametersInfo(int a, int b, string c, int d);",
    "  public static void Set(string p) { SystemParametersInfo(0x0014, 0, p, 3); }",
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
    console.error("[wallpaper] script write failed", e?.message ?? e);
  }
}
function scheduleCapture() {
  if (captureInProgress) return;
  if (captureTimeout) clearTimeout(captureTimeout);
  captureTimeout = setTimeout(async () => {
    if (!renderWindow || renderWindow.isDestroyed()) return;
    captureInProgress = true;
    try {
      if (latestState) {
        renderWindow.webContents.send("sync-state", latestState);
        broadcastState(latestState);
      }
      renderWindow.webContents.invalidate();
      await new Promise((r) => setTimeout(r, 700));
      if (latestFrame && !latestFrame.isEmpty()) {
        fs.writeFileSync(WALLPAPER_FILE, latestFrame.toPNG());
        applyWallpaper();
        console.log("[wallpaper] updated");
      } else {
        console.warn("[wallpaper] skipped - no frame captured");
      }
    } catch (err) {
      console.error("[capture]", err);
    } finally {
      captureInProgress = false;
    }
  }, 300);
}
function startWS() {
  try {
    wss = new import_ws.WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });
  } catch (e) {
    console.error("[ws] failed to create server", e?.message ?? e);
    return;
  }
  wss.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.warn(`[ws] Port ${WS_PORT} busy, retrying in 3s\u2026`);
      setTimeout(() => {
        try {
          wss?.close();
        } catch {
        }
        startWS();
      }, 3e3);
    } else {
      console.error("[ws] error", err);
    }
  });
  wss.on("connection", (ws, req) => {
    connectedClients++;
    const origin = req.headers.origin;
    if (origin && !origin.includes("chrome-extension")) {
      latestOrigin = origin;
    }
    console.log(`[ws] browser client connected (${connectedClients}) from ${origin}`);
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
    ws.on("close", () => {
      connectedClients = Math.max(0, connectedClients - 1);
      console.log(`[ws] browser client disconnected (${connectedClients})`);
    });
  });
  console.log(`[ws] server listening on ws://127.0.0.1:${WS_PORT}`);
}
function createRenderWindow() {
  const display = import_electron.screen.getPrimaryDisplay();
  const width = display.bounds.width;
  const height = display.bounds.height;
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
  renderWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[render] did-fail-load", { code, desc, url });
  });
  renderWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[render] render-process-gone", details);
  });
  renderWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  if (isDev) {
    renderWindow.loadURL("http://localhost:3001");
    renderWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    renderWindow.loadFile(getRendererIndexPath());
    renderWindow.webContents.openDevTools({ mode: "detach" });
  }
  renderWindow.webContents.on("did-finish-load", () => {
    console.log("[render] page loaded, scheduling initial capture\u2026");
    setTimeout(() => scheduleCapture(), 1e3);
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
      const cx = x - 7.5;
      const cy = y - 7.5;
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
function openSettings() {
  const url = latestOrigin ? `${latestOrigin}/wallpaper` : "http://localhost:8080/wallpaper";
  import_electron.shell.openExternal(url).catch((err) => {
    console.error("[shell] failed to open external url", err);
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
        import_electron.app.setLoginItemSettings({
          openAtLogin: true,
          path: import_electron.app.getPath("exe")
        });
      } catch {
      }
    }
    loadState();
    startWS();
    createRenderWindow();
    createTray();
    import_electron.ipcMain.handle("get-initial-state", () => latestState);
    clockTimer = setInterval(() => {
      const now = /* @__PURE__ */ new Date();
      if (now.getMinutes() % 5 === 0) {
        scheduleCapture();
      }
    }, 6e4);
    console.log("[boot] WallTask Companion started successfully");
  });
}
import_electron.app.on("window-all-closed", () => {
});
