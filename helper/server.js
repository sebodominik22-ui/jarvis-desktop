// Jarvis pomocnik pre Windows: bez .exe, bezi cez Node.js (podpisany program).
// Spusti lokalny server na 127.0.0.1 (len pre tvoj PC), otvori Jarvisa v okne Edge a vybavuje prikazy.
// Server prijima prikazy len od stranky Jarvisa (kontrola adresy stranky + tajny token z tohto spustenia).
const http = require("http");
const crypto = require("crypto");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse, nrm, SITES, FALLBACK } = require("../src/parse");

const DASH = "https://prehlad-4kz8xm2q9wvd7rj6.pages.dev/";
const ORIGIN = new URL(DASH).origin;
const TOKEN = crypto.randomBytes(24).toString("hex");
const IS_WIN = process.platform === "win32";

let lastFound = [];
let pending = {};
let lastPing = 0;
let everPinged = false;

function ps(script, env, timeoutMs) {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const p = cp.spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      env: Object.assign({}, process.env, env || {}),
      windowsHide: true,
    });
    const t = setTimeout(() => {
      if (!done) { done = true; try { p.kill(); } catch (e) {} resolve(out); }
    }, timeoutMs || 20000);
    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.on("error", () => { if (!done) { done = true; clearTimeout(t); resolve(out); } });
    p.on("close", () => { if (!done) { done = true; clearTimeout(t); resolve(out); } });
  });
}

// Otvori adresu alebo subor v predvolenej aplikacii (podpisany Windows nastroj).
function spawnFree(cmd, args) {
  const c = cp.spawn(cmd, args, { detached: true, stdio: "ignore" });
  c.on("error", () => {});
  c.unref();
}

function shellOpen(target) {
  spawnFree("rundll32.exe", ["url.dll,FileProtocolHandler", target]);
}

async function openApp(name) {
  const q = nrm(name);
  const out = await ps(
    "$q=$env:JQ; Get-StartApps | Where-Object { $_.Name -like ('*'+$q+'*') } | Select-Object -First 5 | ForEach-Object { $_.Name + '|' + $_.AppID }",
    { JQ: q }
  );
  const rows = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf("|");
    return { name: l.slice(0, i), id: l.slice(i + 1) };
  });
  if (!rows.length) {
    const fb = FALLBACK[q] || SITES[q];
    if (fb) { shellOpen(fb); return { reply: `Aplikáciu „${name}“ som nenašiel, otváram web.`, web: true }; }
    return { reply: `Aplikáciu „${name}“ som medzi nainštalovanými nenašiel.`, notFound: true };
  }
  const exact = rows.find((r) => nrm(r.name) === q) || rows[0];
  if (rows.length > 1 && nrm(exact.name) !== q) {
    return confirmAction(`Otvoriť „${exact.name}“? (podobné: ${rows.map((r) => r.name).join(", ")})`, async () => launchApp(exact));
  }
  return launchApp(exact);
}

function launchApp(app) {
  spawnFree("explorer.exe", ["shell:AppsFolder\\" + app.id]);
  return { reply: `Otváram ${app.name}.` };
}

async function find(query) {
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

function openFound(index) {
  if (!lastFound.length) return { reply: "Najprv ma popros nájsť súbor, napríklad „nájdi súbor faktúra“." };
  const f = lastFound[index];
  if (!f) return { reply: "Takéto číslo v zozname nemám." };
  if (/\.(exe|bat|cmd|ps1|vbs|msi|scr|js|jar|lnk|reg|dll|com|hta|wsf)$/i.test(f)) return { reply: "Spustiteľné súbory neotváram, otvor ho ručne." };
  return confirmAction(`Otvoriť súbor ${path.basename(f)}?`, async () => {
    shellOpen(f);
    return { reply: `Otváram ${path.basename(f)}.` };
  });
}

// Hlasitost cez VBScript (cscript je podpisany Windows program). Ak to Windows zablokuje, otvori Zvuk v nastaveniach.
function volume(mode, value) {
  let body;
  if (mode === "mute") body = "s.SendKeys Chr(173)";
  else if (mode === "up") body = "For i=1 To 5: s.SendKeys Chr(175): Next";
  else if (mode === "down") body = "For i=1 To 5: s.SendKeys Chr(174): Next";
  else body = "For i=1 To 50: s.SendKeys Chr(174): Next" + (value >= 2 ? ": For i=1 To " + Math.round(value / 2) + ": s.SendKeys Chr(175): Next" : "");
  const f = path.join(os.tmpdir(), "jarvis-vol.vbs");
  fs.writeFileSync(f, "Set s = CreateObject(\"WScript.Shell\")\r\n" + body + "\r\n");
  return new Promise((resolve) => {
    cp.execFile("cscript.exe", ["//nologo", f], { timeout: 15000, windowsHide: true }, (err) => {
      if (err) {
        shellOpen("ms-settings:sound");
        return resolve({ reply: "Hlasitosť mi Windows zablokoval, otváram ti Zvuk v nastaveniach." });
      }
      const m = { mute: "Hotovo, zvuk som prepol.", up: "Pridal som hlasitosť.", down: "Ubral som hlasitosť." }[mode];
      resolve({ reply: m || `Hlasitosť je zhruba na ${value} percentách.` });
    });
  });
}

function confirmAction(text, fn) {
  const id = crypto.randomBytes(8).toString("hex");
  pending[id] = { fn, t: Date.now() };
  return { confirm: { text, id } };
}

function searchUrl(target, q) {
  const e = encodeURIComponent(q);
  if (/youtube/.test(target)) return "https://www.youtube.com/results?search_query=" + e;
  if (/mapy|maps/.test(target)) return "https://www.google.com/maps/search/" + e;
  return "https://www.google.com/search?q=" + e;
}

async function runCmd(cmd) {
  switch (cmd.type) {
    case "blocked":
      return { reply: "Mazanie, inštalácie, platby a posielanie správ zatiaľ nerobím, aby sa nič nestratilo ani neodišlo bez teba. Urob to ručne, ja ti rád otvorím, čo treba." };
    case "url":
      if (!/^https?:\/\//.test(cmd.url)) return { reply: "Takúto adresu neotváram." };
      shellOpen(cmd.url);
      return { reply: "Otváram stránku." };
    case "app": return openApp(cmd.name);
    case "search": {
      const url = searchUrl(cmd.target, cmd.query);
      if (cmd.browser) spawnFree("cmd.exe", ["/d", "/s", "/c", 'start "" "' + cmd.browser + '" "' + url + '"']);
      else shellOpen(url);
      return { reply: `Hľadám „${cmd.query}“ ${cmd.browser ? "v " + cmd.target : "v prehliadači"}.` };
    }
    case "type":
      return confirmAction(`Otvorím „${cmd.target}“ a dám text „${cmd.text}“ do schránky (bez odoslania).`, async () => {
        await ps("Set-Clipboard -Value $env:JT", { JT: cmd.text }, 8000);
        const r = await openApp(cmd.target);
        if (r.notFound) return r;
        return { reply: "Otvorené a text je v schránke. Vlož ho Ctrl+V a odošli sám (v tomto režime ho sám nevkladám)." };
      });
    case "find": return find(cmd.query);
    case "open-found": return openFound(cmd.index);
    case "volume": return volume(cmd.mode, cmd.value);
    case "screenshot":
      shellOpen("ms-screenclip:");
      return { reply: "Otvoril som nástroj na výstrižky, vyber oblasť a screenshot sa uloží do schránky." };
    case "timer": {
      const s = cmd.seconds;
      const txt = s >= 3600 ? `${Math.round(s / 360) / 10} hod` : s >= 60 ? `${Math.round(s / 6) / 10} min` : `${s} s`;
      return { reply: `Časovač nastavený na ${txt}.`, timer: s };
    }
    case "timer-cancel": return { reply: "Časovače zrušené.", cancelTimers: true };
    default: return null;
  }
}

function send(res, code, obj, origin) {
  const h = { "Content-Type": "application/json; charset=utf-8" };
  if (origin === ORIGIN) {
    h["Access-Control-Allow-Origin"] = ORIGIN;
    h["Access-Control-Allow-Private-Network"] = "true";
    h["Vary"] = "Origin";
  }
  res.writeHead(code, h);
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (req.method === "OPTIONS") {
    if (origin !== ORIGIN) { res.writeHead(403); return res.end(); }
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "X-JV, Content-Type",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
    return res.end();
  }
  if (origin !== ORIGIN || req.headers["x-jv"] !== TOKEN) return send(res, 403, { error: "forbidden" }, "");
  if (req.method === "GET" && req.url === "/ping") {
    lastPing = Date.now();
    everPinged = true;
    return send(res, 200, { ok: true }, origin);
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (d) => { body += d; if (body.length > 4000) req.destroy(); });
    req.on("end", async () => {
      let j = {};
      try { j = JSON.parse(body || "{}"); } catch (e) {}
      try {
        if (req.url === "/run") {
          const cmd = parse(String(j.text || "").slice(0, 300));
          if (!cmd) return send(res, 200, { handled: false }, origin);
          const r = await runCmd(cmd);
          return send(res, 200, r ? Object.assign({ handled: true }, r) : { handled: false }, origin);
        }
        if (req.url === "/confirm") {
          const p = pending[String(j.id || "")];
          delete pending[String(j.id || "")];
          if (!p || Date.now() - p.t > 60000) return send(res, 200, { handled: true, reply: "Potvrdenie vypršalo, povedz príkaz znova." }, origin);
          const r = await p.fn();
          return send(res, 200, Object.assign({ handled: true }, r), origin);
        }
      } catch (e) {
        return send(res, 200, { handled: true, reply: "Príkaz sa nepodaril: " + String((e && e.message) || e).slice(0, 120) }, origin);
      }
      send(res, 404, { error: "no" }, origin);
    });
    return;
  }
  send(res, 404, { error: "no" }, origin);
});

function edgePath() {
  const c = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  return c.find((p) => fs.existsSync(p)) || null;
}

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const url = DASH + "#jv=" + TOKEN + "." + port;
  console.log("Jarvis pomocnik bezi. Toto okno nechaj minimalizovane, zavrie sa samo po zatvoreni Jarvisa.");
  if (process.env.JV_NOLAUNCH) { console.log("TEST " + TOKEN + " " + port); return; }
  const profile = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "Jarvis", "edge");
  const args = ["--app=" + url, "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "--window-size=1360,860"];
  const exe = edgePath();
  if (IS_WIN && exe) spawnFree(exe, args);
  else if (IS_WIN) spawnFree("cmd.exe", ["/c", "start", "msedge"].concat(args));
  else console.log("Toto nie je Windows, otvor: " + url);
  // Skonci, ked sa Jarvis zatvori (stranka posiela ping kazdych 10 s).
  setInterval(() => {
    const idle = Date.now() - lastPing;
    if ((everPinged && idle > 45000) || (!everPinged && process.uptime() > 180)) process.exit(0);
  }, 5000);
});
