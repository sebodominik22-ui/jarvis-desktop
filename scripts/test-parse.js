// Rychly test rozpoznavania prikazov: npm test
const assert = require("assert");
const { parse } = require("../src/parse");
const cases = [
  ["otvor opera gx", "app"], ["otvor youtube", "url"], ["hlasitosť 40", "volume"], ["zvýš hlasitosť", "volume"],
  ["časovač 5 minút", "timer"], ["zruš časovač", "timer-cancel"], ["urob screenshot", "screenshot"],
  ["nájdi súbor faktúra", "find"], ["otvor 2", "open-found"], ["zmaž súbor x", "blocked"],
  ["pošli správu Janke", "blocked"], ["otvor chrome a vyhľadaj medveď baribal", "search"], ["otvor claude a napíš mu čau", "type"], ["otvor claude", "app"], ["aké je hlavné mesto Francúzska", null], ["najdi mi recept", null],
];
for (const [t, type] of cases) {
  const r = parse(t);
  assert.strictEqual(r ? r.type : null, type, t + " => " + JSON.stringify(r));
}
const s = parse("otvor claude a napíš mu ahoj, ako sa máš"); assert.strictEqual(s.text, "ahoj, ako sa máš");
const q = parse("otvor chrome a vyhľadaj medveď baribal"); assert.strictEqual(q.browser, "chrome"); assert.strictEqual(q.query, "medved baribal");
console.log("OK " + cases.length + " prikazov");
