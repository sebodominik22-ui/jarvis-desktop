// Rychly test rozpoznavania prikazov: npm test
const assert = require("assert");
const { parse } = require("../src/parse");
const cases = [
  ["otvor opera gx", "app"], ["otvor youtube", "url"], ["hlasitosť 40", "volume"], ["zvýš hlasitosť", "volume"],
  ["časovač 5 minút", "timer"], ["zruš časovač", "timer-cancel"], ["urob screenshot", "screenshot"],
  ["nájdi súbor faktúra", "find"], ["otvor 2", "open-found"], ["zmaž súbor x", "blocked"],
  ["pošli správu Janke", "blocked"], ["aké je hlavné mesto Francúzska", null], ["najdi mi recept", null],
];
for (const [t, type] of cases) {
  const r = parse(t);
  assert.strictEqual(r ? r.type : null, type, t + " => " + JSON.stringify(r));
}
console.log("OK " + cases.length + " prikazov");
