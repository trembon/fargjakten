# 🎨 Färgjakten

Ett voxel-färgspel för hela familjen. Välj djur (Capybara, Örn, Apa, Kameleont, Röd panda, Kanin, Räv eller Skunk), jaga varandra med
färgvapen, samla mat och köp bättre vapen hemma i din bas. Spelas i Safari på iPad/iPhone över husets Wi‑Fi.

Spelet består av en liten Node-server som kör spelets regler (träffar, poäng, botar) och skickar en
Three.js-klient till webbläsaren. Alla i huset spelar mot samma server – det behövs ingen internetanslutning.

Koden finns på GitHub: [github.com/trembon/fargjakten](https://github.com/trembon/fargjakten).

## Starta med Docker (på hemservern)

Varje push till GitHub bygger en ny container och lägger den i GitHub Container Registry som
[`ghcr.io/trembon/fargjakten`](https://github.com/trembon/fargjakten/pkgs/container/fargjakten)
(se [CI](#ci-github-actions)). På servern:

```bash
docker run -d --name fargjakten -p 4321:4321 --restart unless-stopped ghcr.io/trembon/fargjakten:latest
```

eller med `docker compose up -d` (se [docker-compose.yml](docker-compose.yml)).
Öppna sedan `http://<serverns-ip>:4321` i Safari på iPad/iPhone.

- Uppdatera till senaste versionen: `docker compose pull && docker compose up -d`
  (eller `docker pull …` och starta om containern).
- Annan port utåt: ändra vänstra siffran, t.ex. `-p 8080:4321`.
- Inställningar via miljövariabler: `-e WIN_SCORE=5` (se nedan).
- Är paketet privat på GitHub behöver servern först `docker login ghcr.io` med en token som har `read:packages`,
  eller så gör du paketet publikt under *Packages → Package settings*.
- Bygga själv från koden: `docker build -t fargjakten .` och `docker run -d -p 4321:4321 fargjakten`.

## Starta lokalt (på Windows-datorn)

Kräver [Node.js](https://nodejs.org) 24 eller senare.

```bash
git clone https://github.com/trembon/fargjakten.git
cd fargjakten
npm install
npm run dev
```

Servern skriver ut adresser, t.ex. `http://192.168.0.171:4321`. Öppna den adressen i Safari på iPad/iPhone
(de måste vara på samma Wi‑Fi). Första gången kan Windows fråga om Node får använda nätverket – tillåt
**privata nätverk**.

Tips: I Safari, tryck Dela → **Lägg till på hemskärmen** så startar spelet i helskärm som en app.
Efter en ändring: tryck **🔄 Sök uppdatering** på startsidan eller i ☰-menyn så laddas den nya versionen.
Appen märker också själv när det finns en ny version och visar en gul knapp.

## Starta eller gå med i ett spel

- Pågår ett spel visar startsidan vilken bana det är, vilka som spelar och lagens poäng. Skriv namn, välj djur och lag och tryck **Gå med!**
- Pågår inget spel väljer du **bana** och antal botar och trycker **Starta nytt spel!**
  - **Parken 🌳** – kulle i mitten, lådor, träd och stenar.
  - **Byn 🏠** – hus som man kan gå in i (dörr in, fönster att skjuta genom), en fontän på torget.
- När ett lag har vunnit visas resultatet en stund, sen går alla tillbaka till startsidan och någon startar nästa spel.
- Ett spel där alla gått ut stängs efter en minut.

## Så spelar man

- **Vänster tumme:** dra var som helst på vänstra halvan = gå (joystick)
- **Höger tumme:** dra på högra halvan = titta runt. Skjutknappen 🎨 kan också dras för att sikta medan du skjuter.
- **⬆ Hoppa**, **★ Förmåga**, **🛒 Butik** och **🐾 Djur** (syns när du är hemma i din bas – där byter du djur gratis, vapen och mat följer med)
- Siktet blir rött när det hjälper dig att sikta på någon.
- Färgen du väljer är ditt **lag** (röd, blå, gul eller grön) – och din bas. Lagkamrater kan inte färga varandra.
- Blir någon helt färgad blir det **PLASK!** (+1 ⭐) och djuret skickas hem. Första laget till 10 ⭐ vinner rundan
  (den som startar ett nytt spel kan välja 10–99 plask på startsidan).
- Hoppa i dammen för att tvätta bort färgen från dig. Medan du tvättar dig kan du inte skjuta. Bara den tåliga capybaran klarar sig mot vattenpistolen när den tvättar sig.
- Dyrare vapen färgar snabbare. Regnbågskanonen och Färgbazookan (60 mat var) är lika starka, och Superslangen är starkast.
- Färgen når inte hur långt som helst – varje vapen har sin räckvidd.
- I din egen bas är du skyddad, men där kan du inte skjuta.
- Färgfläckar i världen torkar bort efter ca 30 sekunder.
- Går man ut (**🚪 Lämna spelet** i menyn) eller tappar nätet behåller man mat, köpta vapen och poäng resten av rundan.
  Tappar iPaden kontakten utan att märka det ansluter spelet själv igen inom några sekunder.
- Lagets ⭐ räknas ihop. Första laget till **10** (eller det antal som valdes när spelet startades) vinner rundan.

| Djur | Special | ★ Förmåga |
|------|---------|-----------|
| Capybara | Tålig, snabb i vatten | Sköld |
| Örn | Håll in hopp i luften för att sväva | Flyg högt |
| Apa | Snabb, dubbelhopp | Spurt |
| Kameleont | – | Nästan osynlig |
| Röd panda | – | Rulla: snabb boll som tar halva färgen |
| Kanin | Hoppar högre | Superhopp |
| Räv | Snabb | Lockbete: en kopia springer iväg och lurar motståndarna (försvinner om den träffas) |
| Skunk | – | Stinkmoln: motståndare i molnet blir långsamma |

På datorn: WASD = gå, klicka för att låsa musen och titta, klick = skjut, mellanslag = hoppa, E = förmåga, B = butik (B/Esc stänger), N = byt djur, M = meny.

## För föräldrar/utvecklare

- `server/` – Node-server (WebSocket, 20 uppdateringar/s). Räknar träffar, mat, butik, rundor och botar.
- `shared/` – inställningar (`constants.js`: djur, vapen, priser), kartan och rörelsefysik – används av både server och klient.
- `client/src/` – Three.js-klienten. Alla modeller är voxlar byggda i kod (`models.js`), så det är lätt att ändra djuren.
- `npm run build` bygger `public/game.js` (måste göras efter ändringar i `client/` eller `shared/`).
- Porten ändras i `shared/constants.js` eller med miljövariabeln `PORT`.
- Lägg till `?fps` i adressen för att se bildfrekvens, ping och största lucka mellan serveruppdateringar (visar om lagg är grafik eller nätverk). Spelet sänker själv upplösningen om enheten är långsam (t.ex. iPad Air 2).
- `node scripts/test-client.js` – snabbtest som startar ett spel (eller går med i det som pågår) och skjuter på en bot i ett annat lag. `MAP=town` väljer Byn.
- Banorna byggs i `shared/map.js` (`MAPS`, `buildPark`, `buildTown`).
- Miljövariabeln `WIN_SCORE` tvingar fram hur många poäng som vinner i alla spel (t.ex. lågt för att testa rundslut)
  och går då före valet på startsidan.

### Tester och validering

```bash
npm run check
npm test
```

- `npm run check` – syntaxkollar alla JS-filer och att JSON-filerna går att läsa.
- `npm test` – bygger klienten och kör testerna i `test/` (Node:s inbyggda testkörare): inställningar, banor,
  rörelse, samt en riktig server som startas på en slumpad port och spelas mot via WebSocket.

### CI (GitHub Actions)

[.github/workflows/ci.yml](.github/workflows/ci.yml) körs vid varje push och pull request:

1. `npm ci`, `npm run check` och `npm test`.
2. Bygger Docker-containern ([Dockerfile](Dockerfile)). Vid push (inte PR) läggs den i
   `ghcr.io/trembon/fargjakten` med taggarna `sha-<commit>`, grenens namn och `latest` (bara från standardgrenen),
   och sedan startas den och kollas att den svarar.
