# Jarvis (desktopova appka pre Windows)

Okno s tvojím prehľadom (tržby, graf, Jarvis s hlasom a HUD) a ovládaním PC. Je to Electron appka.
Samotný vzhľad a Jarvis žijú na stránke https://prehlad-4kz8xm2q9wvd7rj6.pages.dev/ (kód je v repozitári
`prehlad-4kz8xm2q9wvd7rj6`), takže sa po každej úprave stránky appka sama aktualizuje. Tento repozitár
pridáva okno, mikrofón a príkazy pre PC.

## Inštalácia (3 riadky)
1. Stiahni https://github.com/sebodominik22-ui/jarvis-desktop/releases/latest/download/Jarvis-Setup.exe
2. Spusti ho. Windows môže napísať „neznámy vydavateľ", klikni „Ďalšie informácie" a „Spustiť aj tak".
3. Appka sa otvorí sama, ďalej ju nájdeš v ponuke Štart pod názvom Jarvis.

Prvý raz zadaj PIN k mailom v dlaždici Maily a v Nastavenia AI vlož Gemini kľúč (uloží sa len v tvojom PC).

## Čo Jarvis vie na PC (verzia 1)
Povedz alebo napíš:
- „otvor Opera GX", „spusti Spotify" (každá nainštalovaná appka z ponuky Štart)
- „otvor youtube", „otvor github.com"
- „nájdi súbor faktúra", potom „otvor 1" (pred otvorením sa opýta)
- „hlasitosť 40", „zvýš hlasitosť", „ztlm"
- „urob screenshot" (uloží do Obrázky\Jarvis)
- „časovač 5 minút", „zruš časovač"
- čokoľvek iné: odpovedá Gemini (AI)

Zámerne nerobí: mazanie, inštalácie, platby, posielanie správ, vypnutie PC. Takéto príkazy len odmietne.
Mikrofón: v appke sa hlas prepisuje cez Gemini (treba kľúč), pretože Electron nemá vstavané diktovanie.

## Kde je čo (ak to chceš upraviť)
- `main.js`: okno, povolenia, prijímanie príkazov (len od našej stránky)
- `preload.js`: most medzi stránkou a PC (stránka dostane len `jarvisPC.run`, `onTimer`, `version`)
- `src/parse.js`: rozpoznanie príkazov z textu. Sem pridávaj nové slová. Test: `npm test`
- `src/actions.js`: čo sa na PC reálne spustí (Windows PowerShell a Electron)
- `offline.html`: obrazovka bez internetu
- `scripts/make-icon.js`: vygeneruje ikonu
- `.github/workflows/build.yml`: zostaví `Jarvis-Setup.exe` na GitHube pri každej zmene

## Spustenie a zostavenie u seba
Treba Node.js 22.
```
npm install
npm start        # spustí appku
npm test         # test príkazov
npm run dist     # vytvorí dist/Jarvis-Setup.exe (na Windows)
```
Klávesy: F11 celá obrazovka, F5 alebo Ctrl+R obnoví.
