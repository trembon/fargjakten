# 🎨 Färgjakten

Ett voxel-färgspel för hela familjen. Välj djur (Capybara, Örn, Apa, Kameleont, Röd panda eller Kanin), jaga varandra med
färgvapen, samla mat och köp bättre vapen hemma i din bas. Spelas i Safari på iPad/iPhone över husets Wi‑Fi.

## Starta servern (på Windows-datorn)

```
npm install
npm run dev
```

Servern skriver ut adresser, t.ex. `http://192.168.0.171:4321`. Öppna den adressen i Safari på iPad/iPhone
(de måste vara på samma Wi‑Fi). Första gången kan Windows fråga om Node får använda nätverket – tillåt
**privata nätverk**.

Tips: I Safari, tryck Dela → **Lägg till på hemskärmen** så startar spelet i helskärm som en app.
Efter en ändring: tryck **🔄 Sök uppdatering** på startsidan eller i ☰-menyn så laddas den nya versionen.
Appen märker också själv när det finns en ny version och visar en gul knapp.

## Så spelar man

- **Vänster tumme:** dra var som helst på vänstra halvan = gå (joystick)
- **Höger tumme:** dra på högra halvan = titta runt. Skjutknappen 🎨 kan också dras för att sikta medan du skjuter.
- **⬆ Hoppa**, **★ Förmåga**, **🛒 Butik** (syns när du är hemma i din bas)
- Siktet blir rött när det hjälper dig att sikta på någon.
- Färgen du väljer är ditt **lag** (röd, blå, gul eller grön) – och din bas. Lagkamrater kan inte färga varandra.
- Blir någon helt färgad blir det **PLASK!** (+1 ⭐) och djuret skickas hem. Första laget till 10 ⭐ vinner rundan.
- Hoppa i dammen för att tvätta bort färgen från dig.
- Färgen når inte hur långt som helst – varje vapen har sin räckvidd.
- I din egen bas är du skyddad, men där kan du inte skjuta.
- Färgfläckar i världen torkar bort efter ca 30 sekunder.
- Går man ut (t.ex. **🐾 Byt djur** i menyn) eller tappar nätet behåller man mat, köpta vapen och poäng resten av rundan.
  Tappar iPaden kontakten utan att märka det ansluter spelet själv igen inom några sekunder.
- Lagets ⭐ räknas ihop. Första laget till **50** vinner rundan, sen börjar alla om.

| Djur | Special | ★ Förmåga |
|------|---------|-----------|
| Capybara | Tålig, snabb i vatten | Sköld |
| Örn | Håll in hopp i luften för att sväva | Flyg högt |
| Apa | Snabb, dubbelhopp | Spurt |
| Kameleont | – | Nästan osynlig |
| Röd panda | – | Rulla: snabb boll som tar halva färgen |
| Kanin | Hoppar högre | Superhopp |

På datorn: WASD = gå, klicka för att låsa musen och titta, klick = skjut, mellanslag = hoppa, E = förmåga, B = butik (B/Esc stänger), M = meny.

## För föräldrar/utvecklare

- `server/` – Node-server (WebSocket, 20 uppdateringar/s). Räknar träffar, mat, butik, rundor och botar.
- `shared/` – inställningar (`constants.js`: djur, vapen, priser), kartan och rörelsefysik – används av både server och klient.
- `client/src/` – Three.js-klienten. Alla modeller är voxlar byggda i kod (`models.js`), så det är lätt att ändra djuren.
- `npm run build` bygger `public/game.js` (måste göras efter ändringar i `client/` eller `shared/`).
- Porten ändras i `shared/constants.js` eller med miljövariabeln `PORT`.
- Lägg till `?fps` i adressen för att se bildfrekvens, ping och största lucka mellan serveruppdateringar (visar om lagg är grafik eller nätverk). Spelet sänker själv upplösningen om enheten är långsam (t.ex. iPad Air 2).
- `node scripts/test-client.js` – snabbtest som ansluter och skjuter på en bot i ett annat lag.
- Miljövariabeln `WIN_SCORE` ändrar hur många poäng som vinner (t.ex. lågt för att testa rundslut).
