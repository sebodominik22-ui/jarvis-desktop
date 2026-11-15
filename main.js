// Jarvis desktop: hlavny proces. Okno nacita tvoj prehlad (tržby, graf, Jarvis) a pridava ovladanie PC.
const { app, BrowserWindow, ipcMain, shell, session, nativeTheme, Menu } = require("electron");
const path = require("path");
const { parse } = require("./src/parse");
const actions = require("./src/actions");
const fs = require("fs");
const cp = require("child_process");

// Rezim Edge: rozpoznavanie reci v Edge (sk-SK, bez kluca). Pomocnik bezi ako samostatny proces z toho isteho balicka.
function edgeExe() {
  const c = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  return c.find((p) => fs.existsSync(p)) || null;
}
function wantEdge() {
  if (process.platform !== "win32" || process.argv.includes("--electron-ui") || process.env.JV_ELECTRON_UI) return false;
  try { if (fs.existsSync(path.join(app.getPath("userData"), "no-edge"))) return false; } catch (e) {}
  return !!edgeExe();
}
function launchEdgeMode() {
  const child = cp.spawn(process.execPath, [path.join(__dirname, "helper", "server.js")], {
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
    detached: true, stdio: "ignore", windowsHide: true,
  });
  child.on("error", () => {});
  child.unref();
}

// Automaticka aktualizacia appky z GitHub releasu (bez pytania). Cakame najviac 8 s, potom pokracujeme.
function checkUpdate() {
  return new Promise((resolve) => {
    if (!app.isPackaged) return resolve(false);
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = false;
      autoUpdater.on("update-downloaded", () => { fin(true); setTimeout(() => autoUpdater.quitAndInstall(true, true), 300); });
      autoUpdater.on("update-not-available", () => fin(false));
      autoUpdater.on("error", () => fin(false));
      autoUpdater.checkForUpdates().catch(() => fin(false));
      setTimeout(() => fin(false), 8000);
    } catch (e) { fin(false); }
  });
}

const DASH = "https://prehlad-4kz8xm2q9wvd7rj6.pages.dev/";
const ORIGIN = new URL(DASH).origin;

// Zvuk (Gemini hlas, brifing) smie hrat bez klikania.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  nativeTheme.themeSource = "dark";
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#060912",
    title: "Jarvis",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(DASH);

  // Ak nie je internet, ukaz lokalnu stranku, ktora to skusa znova.
  win.webContents.on("did-fail-load", (_e, code, _d, url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, "offline.html"));
  });

  // Mimo nasej stranky sa nic nenavigue v tomto okne, odkazy idu do prehliadaca.
  win.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== ORIGIN && !url.startsWith("file:")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) { win.webContents.reload(); e.preventDefault(); }
    if (input.key === "Escape" && win.isFullScreen()) win.setFullScreen(false);
  });
}

app.whenReady().then(async () => {
  const upd = await checkUpdate();
  if (upd) return;
  if (wantEdge()) { launchEdgeMode(); setTimeout(() => app.quit(), 1500); return; }
  // Mikrofon povol len nasej stranke.
  const mediaOk = (permission, origin) => (permission === "media" || permission === "audioCapture") && String(origin || "").startsWith(ORIGIN);
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    cb(mediaOk(permission, (details && details.requestingUrl) || (wc && wc.getURL())));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, requestingOrigin) => mediaOk(permission, requestingOrigin || (wc && wc.getURL())));

  // Otvori nastavenia mikrofonu vo Windows (len na ziadost nasej stranky).
  ipcMain.handle("pc:mic-settings", async (event) => {
    const url = event.senderFrame ? event.senderFrame.url : "";
    if (url.startsWith(ORIGIN)) await shell.openExternal("ms-settings:privacy-microphone");
    return true;
  });

  // Prikazy pre PC prijimame len od nasej stranky.
  ipcMain.handle("pc:run", async (event, text) => {
    const url = event.senderFrame ? event.senderFrame.url : "";
    if (!url.startsWith(ORIGIN)) return { handled: false };
    const cmd = parse(String(text || "").slice(0, 300));
    if (!cmd) return { handled: false };
    try {
      const r = await actions.run(win, cmd);
      return r ? { handled: true, reply: r.reply } : { handled: false };
    } catch (err) {
      return { handled: true, reply: "Príkaz sa nepodaril: " + String((err && err.message) || err).slice(0, 120) };
    }
  });

  createWindow();
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
});

app.on("window-all-closed", () => app.quit());
