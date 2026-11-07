# jj – Styrke

Treningslogg som kjører rett i nettleseren (`index.html`, lagrer lokalt på enheten).

## Program (fra oktober 2026)

Bygget på Jeff Nippards prinsipper: få, harde sett, siste sett til failure (RIR 0) på trygge øvelser, og long-length partials (LLP) på utvalgte øvelser. Bein trenes én dag, overkroppen tre.

| Dag | Økt | Fokus |
| --- | --- | --- |
| Mandag | Overkropp A | Sideskuldre, triceps, øvre bryst + brystforankret roing |
| Tirsdag | Bein | Vedlikehold: hack squat, RDL, leg curl, leg extension, leggløft, mage |
| Torsdag | Overkropp B | Lats, øvre rygg, bakre delts, armer (supersett) |
| Lørdag | Overkropp C | Tung benk, pull-ups, enarms roing, Y-hev, armer, bakre delts |

Prioritet (harde sett per uke): sideskuldre 12, lats/øvre rygg 14, triceps 9, biceps 8, bakre delts 7. Vedlikehold: bryst 7 (vekt på skrå), mage 3, bein én dag.

12-ukers blokk – appen teller ukene selv (4 økter = 1 uke):

- **Uke 1:** introuke (RIR 2–3, ingen LLP). Bare i første blokk.
- **Uke 2–6 og 8–12:** følg målene i appen. Når alle sett når toppen av rep-intervallet, øker appen vekten.
- **Uke 7:** deload (halve sett, 10 % lettere).
- Etter uke 12 kommer knappen **Start ny blokk**. Er uketelleren feil, juster med − 1 uke / + 1 uke.

## Backup

Loggen lagres bare på enheten. Trykk **Last ned backup** jevnlig (på mobil: velg «Arkiver i Filer» eller Drive). Appen varsler når det har gått 8 økter uten backup. **Gjenopprett** leser inn en backup-fil.

## Offline

Appen kan legges til på Hjem-skjermen og virker uten nett etter første åpning (`sw.js` lagrer filene). Når du endrer filer, bytt `CACHE`-navnet i `sw.js` så telefonen henter den nye versjonen.

Appen viser «Innsats» for hvert sett (RIR og om du skal kjøre LLP). Logghistorikken fra det gamle programmet beholdes; øvelser med samme navn (benk, pull-ups, skrå manualpress, roing, RDL, bulgarsk utfall) fortsetter progresjonen derfra.

## Synk med sky (Cloudflare)

Appen kan lagre loggen i en Cloudflare D1-database, så den finnes på alle enheter og ikke forsvinner med telefonen.

- `functions/api/sync.js` – API-et (Cloudflare Pages Function). Krever D1-binding `DB` og hemmeligheten `SYNC_KEY`.
- `build.sh` – kopierer appfilene til `dist/` ved deploy.

Oppsett i Cloudflare Pages: Build command `bash build.sh`, Build output directory `dist`. Tabellene opprettes automatisk ved første synk.

I appen: **Synk med sky → lim inn synk-nøkkelen → Koble til.** Appen synker når den åpnes, etter hver økt og når nettet kommer tilbake. Økter slås sammen mellom enheter; ingenting slettes.

Lokal test: `bash build.sh && echo 'SYNC_KEY=en-lang-testnokkel-123' > .dev.vars && npx wrangler pages dev dist --d1 DB=styrke-local`
