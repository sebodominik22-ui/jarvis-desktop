# Jarvis (desktopova appka pre Windows)

Okno s tvojím prehľadom (tržby, graf, Jarvis s hlasom a HUD) a ovládaním PC. Je to Electron appka.
Samotný vzhľad a Jarvis žijú na stránke https://prehlad-4kz8xm2q9wvd7rj6.pages.dev/ (kód je v repozitári
`prehlad-4kz8xm2q9wvd7rj6`), takže sa po každej úprave stránky appka sama aktualizuje. Tento repozitár
pridáva okno, mikrofón a príkazy pre PC.

## Spustenie bez .exe (odporúčané, funguje aj so Smart App Control)
Windows 11 Smart App Control blokuje nepodpísané `.exe`. Preto je hlavná cesta bez nich: okno Jarvisa je
Microsoft Edge (podpísaný) a príkazy pre PC vybavuje malý skript v Node.js (podpísaný).
1. Stiahni https://github.com/sebodominik22-ui/jarvis-desktop/archive/refs/heads/main.zip a rozbaľ (pravý klik, Extrahovať všetko).
2. V rozbalenom priečinku dvojklik na `Spusti-Jarvis.bat`. Ak Node.js chýba, nainštaluje ho (winget) a vypíše, aby si bat spustil ešte raz. Ak SmartScreen napíše „Windows chráni váš počítač", klikni „Ďalšie informácie" a „Spustiť aj tak".
3. Otvorí sa okno Jarvis. Prvý raz zadaj PIN v dlaždici Maily a Gemini kľúč v Nastavenia AI (uloží sa len v tvojom PC). Odkaz na bat si daj na plochu (pravý klik, Odoslať, Pracovná plocha).

Okno sa zatvorí krížikom a pomocník sa po minúte sám vypne. Hlas sa diktuje priamo v Edge.
Pomocník počúva len na 127.0.0.1 a prijíma príkazy iba od stránky Jarvisa s tajným tokenom z daného spustenia.

## Inštalátor .exe (len ak Smart App Control nemáš)
Stiahni https://github.com/sebodominik22-ui/jarvis-desktop/releases/latest/download/Jarvis-Setup.exe a spusti.
Na Windows 11 so Smart App Control ho Windows zablokuje (nepodpísané), vtedy použi cestu vyššie.
Poznámka: ani samotný Electron (electron.exe) nie je podpísaný, takže `npm start` Smart App Control tiež nepustí.

## Čo Jarvis vie na PC (verzia 1)
Povedz alebo napíš:
- „otvor Opera GX", „spusti Spotify" (každá nainštalovaná appka z ponuky Štart)
- „otvor youtube", „otvor github.com"
- „nájdi súbor faktúra", potom „otvor 1" (pred otvorením sa opýta)
- „hlasitosť 40", „zvýš hlasitosť", „ztlm"
- „urob screenshot" (cez Edge cestu otvorí výstrižky, v Electron verzii uloží do Obrázky\Jarvis)
- „časovač 5 minút", „zruš časovač"
- čokoľvek iné: odpovedá Gemini (AI)

Zámerne nerobí: mazanie, inštalácie, platby, posielanie správ, vypnutie PC. Takéto príkazy len odmietne.
Mikrofón: v appke sa hlas prepisuje cez Gemini (treba kľúč), pretože Electron nemá vstavané diktovanie.

## Kde je čo (ak to chceš upraviť)
- `main.js`: okno, povolenia, prijímanie príkazov (len od našej stránky)
- `preload.js`: most medzi stránkou a PC (stránka dostane len `jarvisPC.run`, `onTimer`, `version`)
- `helper/server.js`: pomocník pre cestu cez Edge (server na 127.0.0.1, otvorí Edge, vykoná príkazy)
- `Spusti-Jarvis.bat`: spúšťač (skontroluje Node.js a spustí pomocníka)
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
