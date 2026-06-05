import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from "electron";
import * as path from "path";
import { WebSocketServer } from "ws";
import * as fs from "fs";
import { execFile } from "child_process";

// ── Globals ──────────────────────────────────────────────────────
let renderWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let wss: WebSocketServer | null = null;
let latestState: any = null;
let latestFrame: Electron.NativeImage | null = null;
let captureTimeout: ReturnType<typeof setTimeout> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const isDev = !app.isPackaged;
const WS_PORT = 34567;
const userDir = app.getPath("userData");
const STORE_FILE = path.join(userDir, "walltask-state.json");
const WALLPAPER_FILE = path.join(userDir, "walltask-wallpaper.png");
const WP_SCRIPT_FILE = path.join(userDir, "set-wallpaper.ps1");

// ── Persistence ──────────────────────────────────────────────────
function loadState(): void {
  try {
    if (fs.existsSync(STORE_FILE)) {
      latestState = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
    }
  } catch { /* ignore corrupt state */ }
}

function saveState(state: any): void {
  latestState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state));
  } catch { /* ignore write errors */ }
}

// ── Set Windows Wallpaper via PowerShell P/Invoke ────────────────
function applyWallpaper(): void {
  const wp = WALLPAPER_FILE.replace(/\//g, "\\\\");
  const script = [
    'Add-Type @"',
    'using System;using System.Runtime.InteropServices;',
    'public class W{',
    '  [DllImport("user32.dll",CharSet=CharSet.Auto)]',
    '  static extern int SystemParametersInfo(int a,int b,string c,int d);',
    '  public static void Set(string p){SystemParametersInfo(0x0014,0,p,3);}',
    '}',
    '"@',
    `[W]::Set("${wp}")`,
  ].join("\n");
  try {
    fs.writeFileSync(WP_SCRIPT_FILE, script, "utf-8");
    execFile("powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", WP_SCRIPT_FILE],
      (err) => { if (err) console.error("[wallpaper]", err.message); }
    );
  } catch (e: any) {
    console.error("[wallpaper] script write failed", e.message);
  }
}

// ── Capture Offscreen Window → Set as Wallpaper ──────────────────
function scheduleCapture(): void {
  if (captureTimeout) clearTimeout(captureTimeout);
  captureTimeout = setTimeout(async () => {
    if (!renderWindow || renderWindow.isDestroyed()) return;
    // Push latest state to the renderer
    renderWindow.webContents.send("sync-state", latestState);
    // Request a fresh paint
    renderWindow.webContents.invalidate();
    // Wait for render + paint
    await new Promise<void>((r) => setTimeout(r, 1500));
    if (latestFrame && !latestFrame.isEmpty()) {
      try {
        fs.writeFileSync(WALLPAPER_FILE, latestFrame.toPNG());
        applyWallpaper();
        console.log("[wallpaper] updated successfully");
      } catch (e: any) {
        console.error("[capture]", e.message);
      }
    }
  }, 800);
}

// ── WebSocket Server ─────────────────────────────────────────────
function startWS(): void {
  try {
    wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });
  } catch (e: any) {
    console.error("[ws] failed to create server", e.message);
    return;
  }
  wss.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[ws] Port ${WS_PORT} busy, retrying in 3s…`);
      setTimeout(() => { try { wss?.close(); } catch {} startWS(); }, 3000);
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
      } catch { /* malformed message */ }
    });
  });
  console.log(`[ws] server listening on ws://127.0.0.1:${WS_PORT}`);
}

// ── Offscreen Render Window ──────────────────────────────────────
function createRenderWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().size;
  renderWindow = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      offscreen: true,
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  renderWindow.webContents.setFrameRate(1);
  renderWindow.webContents.on("paint", (_e, _dirty, image) => {
    latestFrame = image;
  });

  const url = isDev
    ? "http://localhost:3001"
    : `file://${path.join(__dirname, "../renderer/index.html").replace(/\\/g, "/")}`;
  renderWindow.loadURL(url);

  renderWindow.webContents.on("did-finish-load", () => {
    console.log("[render] page loaded, scheduling initial capture…");
    setTimeout(() => scheduleCapture(), 3000);
  });
  renderWindow.on("closed", () => { renderWindow = null; });
}

// ── System Tray ──────────────────────────────────────────────────
function createTray(): void {
  // Create a 16x16 tray icon programmatically (purple circle)
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - 7.5, cy = y - 7.5;
      const d = Math.sqrt(cx * cx + cy * cy);
      if (d < 6.5) {
        const edge = Math.max(0, 1 - Math.max(0, d - 5.5));
        buf[i] = 160;                      // R
        buf[i + 1] = 100;                  // G
        buf[i + 2] = 255;                  // B
        buf[i + 3] = Math.round(edge * 255); // A
      }
    }
  }
  const icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip("WallTask Companion — Live Wallpaper Sync");

  const menu = Menu.buildFromTemplate([
    { label: "Refresh Wallpaper Now", click: () => scheduleCapture() },
    { type: "separator" },
    { label: "Open WallTask Settings", click: () => openSettings() },
    { type: "separator" },
    { label: "Quit WallTask Companion", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// ── Settings Window ──────────────────────────────────────────────
let settingsWin: BrowserWindow | null = null;
function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    title: "WallTask Companion — Settings",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  const url = isDev ? "http://localhost:8081/wallpaper" : "https://walltask.vercel.app/wallpaper";
  settingsWin.loadURL(url);
  settingsWin.on("closed", () => { settingsWin = null; });
}

// ── Single Instance + Boot ───────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => openSettings());

  app.whenReady().then(() => {
    if (!isDev) {
      try {
        app.setLoginItemSettings({ openAtLogin: true, path: app.getPath("exe") });
      } catch { /* portable mode */ }
    }
    loadState();
    startWS();
    createRenderWindow();
    createTray();

    ipcMain.handle("get-initial-state", () => latestState);

    // Re-capture every 60s so the clock stays current
    clockTimer = setInterval(() => scheduleCapture(), 60_000);
    console.log("[boot] WallTask Companion started successfully");
  });
}

// Keep running as a tray app — don't quit when windows close
app.on("window-all-closed", () => { /* tray app: do nothing */ });
