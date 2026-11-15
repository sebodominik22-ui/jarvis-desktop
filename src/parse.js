// Jarvis desktop: rozpoznanie prikazov z textu (cista funkcia, bez vedlajsich efektov).
// Vrati { type, ... } alebo null, ked to nie je prikaz pre PC (vtedy odpoveda Gemini).

function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9:./ _-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SITES = {
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  gmail: "https://mail.google.com",
  facebook: "https://www.facebook.com",
  instagram: "https://www.instagram.com",
  tiktok: "https://www.tiktok.com",
  github: "https://github.com",
  chatgpt: "https://chatgpt.com",
  netflix: "https://www.netflix.com",
  "google mapy": "https://maps.google.com",
  mapy: "https://maps.google.com",
  disk: "https://drive.google.com",
  "google disk": "https://drive.google.com",
  kalendar: "https://calendar.google.com",
  whatsapp: "https://web.whatsapp.com",
};

// Veci, ktore verzia 1 zamerne nerobi (nic sa nema stratit ani odoslat).
const BLOCKED =
  /\b(zmaz|vymaz|odstran|odinstaluj|nainstaluj|instaluj|stiahni|plat|zaplat|kup|objednaj|posli|odosli|napis spravu|vypni pocitac|restartuj|restart pc|formatuj)\b/;

function parse(text) {
  const n = nrm(text).replace(/^(jarvis|jarvise|hej jarvis|ahoj jarvis)[ ,]+/, "");
  if (!n) return null;

  if (BLOCKED.test(n)) return { type: "blocked", what: n };

  // casovac
  if (/\b(zrus|zastav|vypni)\b.*\b(casovac|stopky)/.test(n)) return { type: "timer-cancel" };
  const tm = n.match(/(\d+)\s*(sekund\w*|sek\b|s\b|minut\w*|min\b|m\b|hodin\w*|hod\b|h\b)/);
  if (tm && /\b(casovac|stopky|pripomen|odpocitaj|budik|zobud)/.test(n)) {
    const v = parseInt(tm[1], 10);
    const u = tm[2][0];
    const sec = u === "s" ? v : u === "m" ? v * 60 : v * 3600;
    if (sec > 0 && sec <= 24 * 3600) return { type: "timer", seconds: sec };
  }

  // hlasitost
  if (/\b(ztlm|stlm|mute|ticho|vypni zvuk|stisni zvuk|vypni hlasitost)\b/.test(n)) return { type: "volume", mode: "mute" };
  if (/\bzapni zvuk\b|\bodtlm\b/.test(n)) return { type: "volume", mode: "mute" };
  if (/hlasitost|zvuk|hlasnej|tichsie|hlasnejsie/.test(n)) {
    const m = n.match(/(\d{1,3})\s*(%|percent)?/);
    if (m && /nastav|daj|na \d|hlasitost \d/.test(n)) {
      return { type: "volume", mode: "set", value: Math.max(0, Math.min(100, parseInt(m[1], 10))) };
    }
    if (/zvys|pridaj|hlasnej|hlasnejsie|zosil/.test(n)) return { type: "volume", mode: "up" };
    if (/zniz|uber|tichsie|zoslab|stis/.test(n)) return { type: "volume", mode: "down" };
    if (m) return { type: "volume", mode: "set", value: Math.max(0, Math.min(100, parseInt(m[1], 10))) };
  }

  // screenshot
  if (/\b(screenshot|snimku obrazovky|snimka obrazovky|odfot\w* obrazovku|urob screen)/.test(n)) return { type: "screenshot" };

  // najdi subor
  let m = n.match(/^(?:najdi|vyhladaj|hladaj|kde je)\s+(?:mi\s+)?(?:subor|file|dokument|obrazok|fotku|video|pdf)\s+(.+)$/);
  if (m && m[1]) {
    const q = m[1].replace(/[^a-z0-9 ._-]/g, "").trim();
    if (q.length >= 2) return { type: "find", query: q.slice(0, 60) };
  }

  // otvor nalezeny subor cislo N
  m = n.match(/^otvor\s+(?:subor\s+)?(?:cislo\s+|c\.?\s*)?(\d)$/);
  if (m) return { type: "open-found", index: parseInt(m[1], 10) - 1 };
  m = n.match(/^otvor\s+(prvy|druhy|treti)(?:\s+subor)?$/);
  if (m) return { type: "open-found", index: { prvy: 0, druhy: 1, treti: 2 }[m[1]] };

  // otvor / spusti
  m = n.match(/^(?:otvor|spusti|zapni|pust)\s+(?:mi\s+)?(?:aplikaciu\s+|program\s+|stranku\s+|web\s+)?(.+)$/);
  if (m) {
    const t = m[1].trim();
    if (/^https?:\/\//.test(t)) return { type: "url", url: t };
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(t)) return { type: "url", url: "https://" + t };
    if (SITES[t]) return { type: "url", url: SITES[t] };
    return { type: "app", name: t.slice(0, 50) };
  }

  return null;
}

module.exports = { parse, nrm, SITES };
