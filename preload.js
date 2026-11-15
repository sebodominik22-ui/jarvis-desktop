// Jarvis desktop: most medzi strankou a PC. Stranka dostane len tieto tri veci.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvisPC", {
  version: "1.0.0",
  run: (text) => ipcRenderer.invoke("pc:run", String(text || "").slice(0, 300)),
  onTimer: (cb) => {
    if (typeof cb === "function") ipcRenderer.on("pc:timer", (_e, msg) => cb(String(msg)));
  },
});
