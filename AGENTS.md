# AGENTS.md

Instruktioner för AI-agenter (och människor) som ändrar i projektet. Se [README.md](README.md) för vad spelet är
och hur koden är uppdelad.

## Klart betyder

En ändring räknas som färdig först när:

1. **Testerna är gröna** – `npm run check` och `npm test` går igenom utan fel (samma sak som körs i GitHub Actions).
   Lägg till eller uppdatera tester i `test/` när du ändrar beteende.
2. **Dokumentationen är uppdaterad vid behov** – ändras hur man startar, spelar, konfigurerar eller bygger
   (t.ex. nya kontroller, banor, djur, miljövariabler, Docker eller CI) ska `README.md` uppdateras i samma ändring.

## Bra att veta

- Ändringar i `client/` eller `shared/` kräver `npm run build` (görs automatiskt av `npm test` och i Docker-bygget).
- Spelets texter och kodkommentarer är på svenska.
