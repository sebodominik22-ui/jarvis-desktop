// Jarvis desktop: vykonavanie prikazov na PC (Windows). Kazda funkcia vrati { reply: "text" }.
// Pravidla: ziadne mazanie, instalacie, platby ani odosielanie. Citlive veci idu cez potvrdenie.
const { app, dialog, shell, desktopCapturer, screen, Notification } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { nrm } = require("./parse");

let lastFound = [];
let timers = [];

// Spusti PowerShell s parametrami cez prostredie (nikdy nie vlozene do textu skriptu).
function ps(script, env, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const p = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        try { p.kill(); } catch (e) {}
        resolve(out);
      }
    }, timeoutMs);
    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.on("error", () => { if (!done) { done = true; clearTimeout(t); resolve(out); } });
    p.on("close", () => { if (!done) { done = true; clearTimeout(t); resolve(out); } });
  });
}

function confirm(win, message, detail) {
  const r = dialog.showMessageBoxSync(win, {
    type: "question",
    buttons: ["Áno", "Nie"],
    defaultId: 1,
    cancelId: 1,
    title: "Jarvis",
    message,
    detail: detail || "",
    noLink: true,
  });
  return r === 0;
}

async function openApp(win, name) {
  const q = nrm(name);
  const out = await ps(
    "$q=$env:JQ; Get-StartApps | Where-Object { $_.Name -like ('*'+$q+'*') } | Select-Object -First 5 | ForEach-Object { $_.Name + '|' + $_.AppID }",
    { JQ: q }
  );
  const rows = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf("|");
    return { name: l.slice(0, i), id: l.slice(i + 1) };
  });
  if (!rows.length) return { reply: `Aplikáciu „${name}“ som medzi nainštalovanými nenašiel.` };
  const exact = rows.find((r) => nrm(r.name) === q) || rows[0];
  if (rows.length > 1 && nrm(exact.name) !== q && !confirm(win, `Otvoriť „${exact.name}“?`, "Našlo sa viac podobných aplikácií: " + rows.map((r) => r.name).join(", "))) {
    return { reply: "Dobre, neotváram." };
  }
  spawn("explorer.exe", ["shell:AppsFolder\\" + exact.id], { detached: true, stdio: "ignore" }).unref();
  return { reply: `Otváram ${exact.name}.` };
}

async function find(win, query) {
  const out = await ps(
    "$q=$env:JQ; $h=$env:USERPROFILE; $dirs='Desktop','Documents','Downloads','Pictures','Videos','Music','OneDrive' | ForEach-Object { Join-Path $h $_ } | Where-Object { Test-Path $_ }; " +
      "Get-ChildItem -Path $dirs -Recurse -Depth 6 -File -ErrorAction SilentlyContinue -Filter ('*'+$q+'*') | Sort-Object LastWriteTime -Descending | Select-Object -First 5 -ExpandProperty FullName",
    { JQ: query },
    25000
  );
  lastFound = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lastFound.length) return { reply: `Súbor „${query}“ som v tvojich priečinkoch nenašiel.` };
  const names = lastFound.map((f, i) => `${i + 1}. ${path.basename(f)}`).join("; ");
  return { reply: `Našiel som ${lastFound.length}: ${names}. Povedz „otvor 1“ a otvorím ho.` };
}

function openFound(win, index) {
  if (!lastFound.length) return { reply: "Najprv ma popros nájsť súbor, napríklad „nájdi súbor faktúra“." };
  const f = lastFound[index];
  if (!f) return { reply: "Takéto číslo v zozname nemám." };
  const risky = /\.(exe|bat|cmd|ps1|vbs|msi|scr|js|jar|lnk|reg)$/i.test(f);
  if (risky) return { reply: "Spustiteľné súbory neotváram, otvor ho ručne." };
  if (!confirm(win, `Otvoriť súbor ${path.basename(f)}?`, f)) return { reply: "Dobre, neotváram." };
  shell.openPath(f);
  return { reply: `Otváram ${path.basename(f)}.` };
}

async function volume(mode, value) {
  // Windows nema jednoduchy skript na hlasitost: pouzijeme multimedialne klavesy (kazdy krok je 2 %).
  let keys;
  if (mode === "mute") keys = "$w.SendKeys([char]173)";
  else if (mode === "up") keys = "1..5 | ForEach-Object { $w.SendKeys([char]175) }";
  else if (mode === "down") keys = "1..5 | ForEach-Object { $w.SendKeys([char]174) }";
  else {
    const steps = Math.round(value / 2);
    keys = "1..50 | ForEach-Object { $w.SendKeys([char]174) }; 1.." + steps + " | ForEach-Object { $w.SendKeys([char]175) }";
    if (steps < 1) keys = "1..50 | ForEach-Object { $w.SendKeys([char]174) }";
  }
  await ps("$w = New-Object -ComObject WScript.Shell; " + keys, {}, 15000);
  if (mode === "mute") return { reply: "Hotovo, zvuk som prepol." };
  if (mode === "up") return { reply: "Pridal som hlasitosť." };
  if (mode === "down") return { reply: "Ubral som hlasitosť." };
  return { reply: `Hlasitosť je zhruba na ${value} percentách.` };
}

async function screenshot(win) {
  const d = screen.getPrimaryDisplay();
  const size = { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  const srcs = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: size });
  if (!srcs.length) return { reply: "Obrazovku sa nepodarilo nasnímať." };
  const dir = path.join(app.getPath("pictures"), "Jarvis");
  fs.mkdirSync(dir, { recursive: true });
  const t = new Date();
  const p2 = (x) => String(x).padStart(2, "0");
  const file = path.join(dir, `screenshot-${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}-${p2(t.getHours())}${p2(t.getMinutes())}${p2(t.getSeconds())}.png`);
  fs.writeFileSync(file, srcs[0].thumbnail.toPNG());
  shell.showItemInFolder(file);
  return { reply: "Screenshot je uložený v Obrázky, priečinok Jarvis." };
}

function startTimer(win, seconds) {
  const id = setTimeout(() => {
    timers = timers.filter((x) => x.id !== id);
    const msg = "Časovač je hotový.";
    try { new Notification({ title: "Jarvis", body: msg }).show(); } catch (e) {}
    shell.beep();
    if (win && !win.isDestroyed()) win.webContents.send("pc:timer", msg);
  }, seconds * 1000);
  timers.push({ id });
  const txt = seconds >= 3600 ? `${Math.round(seconds / 360) / 10} hod` : seconds >= 60 ? `${Math.round(seconds / 6) / 10} min` : `${seconds} s`;
  return { reply: `Časovač nastavený na ${txt}.` };
}

async function run(win, cmd) {
  switch (cmd.type) {
    case "blocked":
      return { reply: "Mazanie, inštalácie, platby a posielanie správ zatiaľ nerobím, aby sa nič nestratilo ani neodišlo bez teba. Urob to ručne, ja ti rád otvorím, čo treba." };
    case "url":
      if (!/^https?:\/\//.test(cmd.url)) return { reply: "Takúto adresu neotváram." };
      await shell.openExternal(cmd.url);
      return { reply: "Otváram stránku." };
    case "app": return openApp(win, cmd.name);
    case "find": return find(win, cmd.query);
    case "open-found": return openFound(win, cmd.index);
    case "volume": return volume(cmd.mode, cmd.value);
    case "screenshot": return screenshot(win);
    case "timer": return startTimer(win, cmd.seconds);
    case "timer-cancel":
      timers.forEach((t) => clearTimeout(t.id));
      timers = [];
      return { reply: "Časovače zrušené." };
    default:
      return null;
  }
}

module.exports = { run };
