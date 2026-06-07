import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell } from "electron";
import * as path from "path";
import { WebSocketServer } from "ws";
import * as fs from "fs";
import { execFile } from "child_process";

let captureInProgress = false;
let connectedClients = 0;
let renderWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let wss: WebSocketServer | null = null;
let latestState: any = null;
let latestFrame: Electron.NativeImage | null = null;
let captureTimeout: ReturnType<typeof setTimeout> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
let latestOrigin: string | null = null;

const isDev = !app.isPackaged;
const WS_PORT = 34567;

const userDir = app.getPath("userData");
const STORE_FILE = path.join(userDir, "walltask-state.json");
const WALLPAPER_FILE = path.join(userDir, "walltask-wallpaper.png");
const WP_SCRIPT_FILE = path.join(userDir, "set-wallpaper.ps1");

function getRendererIndexPath() {
  return path.join(__dirname, "renderer", "index.html");
}

function loadState(): void {
  try {
    if (fs.existsSync(STORE_FILE)) {
      latestState = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
    }
  } catch {
    latestState = null;
  }
}

function saveState(state: any): void {
  latestState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("[state] save failed", err);
  }
}

function broadcastState(state: any): void {
  if (!wss) return;

  const payload = JSON.stringify({ type: "SYNC_STATE", state });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

function applyWallpaper(): void {
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
    `[W]::Set("${wp}")`,
  ].join("\n");

  try {
    fs.writeFileSync(WP_SCRIPT_FILE, script, "utf-8");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", WP_SCRIPT_FILE],
      (err) => {
        if (err) console.error("[wallpaper]", err.message);
      }
    );
  } catch (e: any) {
    console.error("[wallpaper] script write failed", e?.message ?? e);
  }
}

function scheduleCapture(): void {
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
      await new Promise<void>((r) => setTimeout(r, 700));

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

function startWS(): void {
  try {
    wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });
  } catch (e: any) {
    console.error("[ws] failed to create server", e?.message ?? e);
    return;
  }

  wss.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      console.warn(`[ws] Port ${WS_PORT} busy, retrying in 3s…`);
      setTimeout(() => {
        try {
          wss?.close();
        } catch {}
        startWS();
      }, 3000);
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
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      connectedClients = Math.max(0, connectedClients - 1);
      console.log(`[ws] browser client disconnected (${connectedClients})`);
    });
  });

  console.log(`[ws] server listening on ws://127.0.0.1:${WS_PORT}`);
}

function createRenderWindow(): void {
  const display = screen.getPrimaryDisplay();
  const width = display.bounds.width;
  const height = display.bounds.height;

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
    renderWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    renderWindow.loadFile(getRendererIndexPath());
    renderWindow.webContents.openDevTools({ mode: 'detach' });
  }

  renderWindow.webContents.on("did-finish-load", () => {
    console.log("[render] page loaded, scheduling initial capture…");
    setTimeout(() => scheduleCapture(), 1000);
  });

  renderWindow.on("closed", () => {
    renderWindow = null;
  });
}

function createTray(): void {
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

function openSettings(): void {
  const url = latestOrigin ? `${latestOrigin}/wallpaper` : "http://localhost:8080/wallpaper";
  shell.openExternal(url).catch((err) => {
    console.error("[shell] failed to open external url", err);
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  // Force 2x scaling globally so the offscreen wallpaper render is crisp 4K quality
  app.commandLine.appendSwitch("force-device-scale-factor", "2");

  app.on("second-instance", () => openSettings());

  app.whenReady().then(() => {
    if (!isDev) {
      try {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: app.getPath("exe"),
        });
      } catch {
        // ignore portable / restricted environments
      }
    }

    loadState();
    startWS();
    createRenderWindow();
    createTray();

    ipcMain.handle("get-initial-state", () => latestState);

    clockTimer = setInterval(() => {
      const now = new Date();
      if (now.getMinutes() % 5 === 0) {
        scheduleCapture();
      }
    }, 60_000);

    console.log("[boot] WallTask Companion started successfully");
  });
}

app.on("window-all-closed", () => {
  // keep running in tray
});