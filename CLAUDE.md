@AGENTS.md

# Partiko

Belső alapanyag-rendelés-nyilvántartó és heti menü szerkesztő a Partiko Kft. (gyorsétterem-alapanyag beszállító) számára. Kis, megbízható felhasználói kör (a család) használja telefonról. **2026-07-06-tól jelszavas belépés védi** (lásd "Belépés/autentikáció" szekció lent) — a korábbi "nincs autentikáció" döntés csak addig volt érvényes, amíg a rendelési adatok meg nem jelentek az appban.

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- Prisma 7 + `@prisma/adapter-pg` (driver-adapter architektúra — **Prisma 7-ben a `datasource` blokk a schema.prisma-ban már nem tartalmazhat `url`-t**; a connection string csak a `prisma.config.ts`-ben (CLI/migrációkhoz) és a `src/lib/db.ts`-ben, a `PrismaPg` adapter konstruktorában él)
- Generált Prisma kliens belépési pontja `src/generated/prisma/client.ts`, **nem** `index.ts` → import mindig `@/generated/prisma/client`
- Supabase Postgres — `DATABASE_URL` (6543-as port, pgbouncer, tranzakciós mód, ezt használja az app futásidőben), `DIRECT_URL` (5432-es port, session mód, csak `prisma migrate`-hez)
- Vercel deploy GitHub auto-deploy-n keresztül; `postinstall: prisma generate` gondoskodik róla hogy Vercel build közben újragenerálódjon a kliens
- `docx` csomag a heti menü Word-exportjához (`src/lib/generateMenuDocx.ts`)
- Vitest az automatikus teszteknek (`npm test`)

**⚠️ A helyi fejlesztői környezet és az éles Vercel-deploy ugyanazt az élő Supabase adatbázist használja.** Nincs külön teszt-DB. Ebből következik:
- Bármilyen script vagy manuális teszt, amit helyben futtatsz, **valós adatot ír/töröl**.
- Az automatikus tesztek (Vitest) ezért kizárólag DB-mentes, tiszta logikát tesztelnek (dátumszámítás, validáció, docx-generálás, illetve a Prisma klienst `vi.mock("@/lib/db")`-vel lemockolt logika). **Soha ne írj olyan Vitest tesztet, ami a valódi `prisma` klienst importálja.**
- Ha manuálisan kell tesztelni valós DB-hívást (pl. új API route smoke-teszt), a teszt végén expliciten töröld/állítsd vissza amit létrehoztál, és ellenőrizd hogy a rekordszámok (alapanyagok, bejegyzések, számlázási időszakok, heti menük) pontosan ugyanazok maradtak, mint előtte.

## Adatmodell (`prisma/schema.prisma`)

- **`Ingredient`** — alapanyag-katalógus. `unitPrice` egész szám (Ft, nem lehet tizedestört — a DB oszlop `Int`). `order` határozza meg a megjelenítési sorrendet az Összesítő táblázatban. `archived` — a `DELETE /api/ingredients/[id]` csak akkor törli ténylegesen a sort, ha **nincs hozzá tartozó `Entry`**; ha van, csak `archived: true`-ra állítja (soft delete), és a válasz teste is ezt jelzi vissza (`{ingredient, archived: true}` vs. hard delete-nél `{archived: false}`).
- **`Entry`** — egy adott napi (`date`) alapanyag-mennyiség (`quantity`, `Float`, tizedestört engedélyezett) rögzítése. `createdAt` a rögzítés valós időpontja — **ez eltér a `date` mezőtől**, és ennek jelentősége van (lásd lent).
- **`BillingPeriod`** — egy lezárt számlázási időszak (`from`/`to` dátumtartomány + `closedAt` időbélyeg). A "Tételek leszámlázva" gomb hozza létre.
- **`WeeklyMenu`** — egy hét (`weekStart`, mindig hétfő) A/B/C menüje `days` JSON mezőben (5 elemű tömb, mezőnként `a/b/c` string + `aGM/bGM/cGM` boolean a gluténmentes jelöléshez). `published`/`publishedAt` — az ügyfél-rendelő felület csak a `published: true` menüt látja; a `heti-menu` oldal Mentés gombja sosem módosítja ezt a mezőt, csak a külön "Közzététel" gomb (`PATCH /api/weekly-menu/publish`).
- **`Customer`** — ügyfél-azonosító (bolt/megrendelő neve), jelszó nélküli "azonosítás" az ügyfél-rendelő oldalon. Nincs egyediségi kényszer a néven (find-or-create `findFirst`+`create` `storeName` alapján). A `companyName` mező **2026-07-08 óta megmaradt a sémában, de az UI már nem gyűjti/kéri** (nem minden rendelő cég) — új ügyfélnél mindig `""`; a régebbi, ténylegesen kitöltött értékek megmaradtak a régi rekordokon, csak semmi nem olvassa/jeleníti meg többé.
- **`Order`** / **`OrderLine`** — egy ügyfél egy adott hétre (`weekStart`) leadott rendelése, relációs soronként (`dayIndex` 0-4, `letter` a/b/c, `isXl` boolean, `quantity`). Egy adott nap+betű kombinációhoz **két sor** is tartozhat: egy normál (`isXl: false`) és egy XL (`isXl: true`) — az XL ugyanaz az étel, csak nagyobb adag, nem külön menüpont. Nulla mennyiségű sor nem kerül tárolásra. `@@unique([customerId, weekStart])` az `Order`-en — újbóli beküldés felülírja (upsert), nem duplikál; `@@unique([orderId, dayIndex, letter, isXl])` az `OrderLine`-on.

## Ügyfél-rendelés funkció (Rendelések fül + publikus API)

- **Melyik hét rendelhető, mikor** (`getActiveOrderWeek` — `src/lib/dates.ts`): hétfő 00:00 – csütörtök 10:00 (Budapest idő) között a **jelenlegi hét** a célhét (napi rendelők miatt), utána a **következő hét**. Csütörtök 10:00 után a következő hét csak akkor rendelhető, ha az owner közzétette (`published: true`) — eddig a pillanatig a rendelő felület "még nincs kész" üzenetet mutat. Nincs Szombat-határidő kikényszerítés: amíg a célhét aktív és publikált, bármennyiszer újraküldhető a rendelés.
  - **Időzóna-buktató**: a cutoff Budapest wall-clock idő (`Intl.DateTimeFormat` `Europe/Budapest` timeZone-nal), **nem** UTC — Vercel serverless UTC-ben fut, szóval `now.getUTCHours()`-t használni itt bug lenne.
- **Napi zárolás, külön a heti cutoff-tól** (`getLockedDayIndexes` — `src/lib/dates.ts`, **2026-07-08 óta a jelenlegi szabály**): a konyha minden hétköznapot a naptári nappal *előtte* 10:00-kor zár le (mert aznap már azt főzi meg) — vasárnap 10:00 a hétfőit, hétfő 10:00 a keddit, ..., csütörtök 10:00 a péntekit (ez utóbbi egybeesik a heti cutoff-fal fent). Emiatt **a mai nap mindig már zárolt** (tegnap 10-kor lezárt), és a holnapi nap is zárolttá válik, amint ma elmúlik 10:00 — nem csak a "ma előtti" napok zároltak, ahogy korábban (2026-07-08 előtt) volt, az egy hibás viselkedés volt, amit a felhasználó jelzett (szerdán a szerdai kaját még lehetett módosítani, pedig azt már kedden megfőzték).
- **Publikus API** (`src/app/api/public/**`) — CORS-szal ellátva (`src/lib/cors.ts`, `withCors` + `corsPreflight`), az `ALLOWED_ORIGINS` env változóban (vesszővel elválasztott lista) felsorolt originek kapják meg az `Access-Control-Allow-Origin` fejlécet, más nem. Ez teszi lehetővé, hogy a különálló ügyfél-rendelő projekt (más origin/domain) hívja ezeket a route-okat.
  - `GET /api/public/order-window` — aktív hét + nyitva van-e + zárolt napok.
  - `GET /api/public/menu?week=` — csak akkor adja vissza a `days`-t, ha `published: true` (independent recheck, nem csak az order-window válaszára hagyatkozva).
  - `POST /api/public/customers`, `GET /api/public/customers/[id]` — find-or-create ügyfél-azonosítás **csak `storeName` alapján** (2026-07-08 óta, korábban `storeName`+`companyName` párra ment a keresés — lásd fent a `Customer` modellnél), nincs jelszó/session, a kliens csak a visszakapott `customerId`-t tárolja (localStorage a rendelő projektben).
  - `GET/PUT /api/public/orders` — a PUT elutasítja (409) az írást, ha a beküldött `weekStart` nem egyezik a jelenleg aktív héttel, vagy az nincs publikálva (véd egy nyitva felejtett, elavult tab ellen egy Thursday-10:00 váltás után).
- **XL adag** (`src/lib/orders.ts`): minden A/B/C ételhez a normál mennyiség mellett külön XL mennyiség is rendelhető (`aXl`/`bXl`/`cXl` mező az `OrderDayQuantities`-ben) — ugyanaz az étel, csak nagyobb adag, nem külön menüpont. `quantityField(letter, isXl)` adja meg melyik mezőt (pl. `a` vagy `aXl`) kell írni/olvasni egy adott `letter`+`isXl` kombinációhoz. Megjelenítésnél (Rendelések oldal + `.xlsx`) egy cellában, összevonva jelenik meg: `"2 (+1 XL)"` (`formatCell`), ha csak XL van `"+1 XL"`, ha se normál se XL nincs, üres. A heti "Összesen" (`weekTotalMeals`) az XL adagokat is beleszámolja, ugyanazon az áron (`MEAL_PRICE_FT = 1200` Ft/adag, nincs XL felár).
- **Owner-oldali összesítés (képernyőn)**: `GET /api/orders/summary` (`src/lib/ordersSummary.ts`) + `Rendelések` oldal (`src/app/rendelesek/page.tsx`) — a KÖVETKEZŐ nap rendeléseit mutatja boltonként (ugyanaz a nap, mint amit a `.xlsx` export letölt, lásd lent), a tényleges étel nevekkel oszlopfejlécben (nem A/B/C), alul pedig egy "Heti összesítés" blokk: az adott hétre összesen hány kaja lett rendelve + az érték. Nincs hét-navigáció, mindig az aktuális állapotot mutatja.
  - **Hetek közötti átfedés (2026-07-09 óta kezelve, 2026-07-09-én finomítva)**: a megjelenített hét (`getExportDay` — "holnap" naptári hete) és az aktív rendelési hét (`getActiveOrderWeek` — amire az ügyfelek épp rendelhetnek) csütörtök 10:00 és a rákövetkező vasárnap között **eltér egymástól** (az ügyfelek már a jövő hétre rendelnek, de "holnap" még a jelenlegi hét naptári napja). Ha `activeWeek.weekStart !== weekStart`, a válasz tartalmaz egy `nextWeek` mezőt (`getOrdersSummary(activeWeek.weekStart)` alapján, boltonként napi bontásban összesítve: `{weekStart, dayTotals, byCustomer, totalMeals, totalValue}`). A `Rendelések` oldalon ilyenkor a `nextWeek` **teljesen átveszi a fő nézet helyét** — a jelenlegi (már "lezárt" hétnek számító) napi/heti bontás el sem tűnik, hanem eleve meg sem jelenik, a "Következő heti rendelések" táblázat (Üzlet × H/K/Sze/Cs/P + Összesen) és a hozzá tartozó "Heti összesítés" jelenik meg helyette. A `.xlsx` export gomb (`GET /api/orders/export`) ettől függetlenül mindig a szó szerinti "holnapot" exportálja (lásd lent) — ez a váltás csak a képernyőn megjelenő összesítőt érinti.
- **`.xlsx` export mindig a KÖVETKEZŐ napra szól, nem hétre** (`GET /api/orders/export`, `getExportDay` — `src/lib/dates.ts`, `getOrdersForDay`/`getDishNamesForDay` — `src/lib/ordersSummary.ts`, `generateOrdersXlsx` — `src/lib/generateOrdersXlsx.ts`, `exceljs`): a konyha mindig a másnapi ételt főzi meg aznap (pl. vasárnap a hétfői menüt), ezért a letöltés gomb **nem vesz fel `week`/`date` paramétert**. A formátum a cég valódi, kézzel vezetett papír-táblázatát követi pontosan (lásd a Drive-on a `KÉSZÉTEL.xls` referenciát): egyetlen munkalap `KAJA <NAP>` néven, **bal felső fejléc-cella = a nap neve** (nem "Üzlet"), a többi oszlopfejléc a tényleges étel nevek (A/B/C helyett), soronként egy-egy üzlet **cégnév oszlop nélkül** + alul félkövér "Összesen" sor. Minden cellán nyomtatásbarát rácsvonal (`applyGridBorders`): függőlegesen (oszlopok között) `medium` vastagságú, vízszintesen (sorok között) `thin` — mert üres A4 lapra nyomtatják ki. Az étel-oszlopok szélesek (`width: 38`) és a fejléc sor tördel (`wrapText`, két soros is lehet), hogy a hosszú étel-nevek is kiférjenek; a mennyiség-oszlopok középre igazítottak. A `sheet.pageSetup` A4-re, **álló** tájolásra (sok bolt esetén a lista hosszú, függőlegesen kell a hely, nem fekvő) és egy oldal szélességre skálázásra (`fitToWidth: 1, fitToHeight: 0`) van állítva, hogy nyomtatáskor mindig egy lapra férjen szélességben, a sorok száma viszont szabadon nő. Ha a holnapi nap szombat/vasárnap (nincs menünap), üres, de érvényes fájlt ad vissza.
- **Különálló ügyfél-rendelő projekt**: `c:\Claude\partiko-rendeles` — saját Next.js app, **nincs saját adatbázis-kapcsolata**, minden adatot a fenti publikus API-n keresztül `fetch`-el (`NEXT_PUBLIC_PARTIKO_API_BASE` env változó adja meg a partiko backend URL-jét). Egyelőre csak helyben fut; a tervek szerint majd a testvér által készített `partiko-landing` weboldalba kerül be/lesz onnan linkelve.

## Belépés/autentikáció (`src/proxy.ts`, `src/lib/auth.ts`)

- Egyetlen, hardcoded admin fiók (`ADMIN_USERNAME`/`ADMIN_PASSWORD` env változók, jelenleg `godo`/`1412`) — nincs `User` tábla, nincs több felhasználó, ez tudatos egyszerűsítés (kis, megbízható kör, csak a tulajdonosok).
- Munkamenet: `SESSION_SECRET`-tel HMAC-SHA256-tal aláírt, stateless cookie (`partiko_session`, 90 napig érvényes) — nincs DB-ben tárolt session, a token maga tartalmazza a lejáratot + aláírást (`createSessionToken`/`isValidSessionToken`).
- **Next 16-ban a `middleware.ts` át lett nevezve `proxy.ts`-re** (deprecation, lásd `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) — a fájl `src/proxy.ts`, az exportált függvény neve `proxy`, nem `middleware`.
- A `src/proxy.ts` mindent véd (oldalak + API route-ok), **kivéve**: `/bejelentkezes` (login oldal), `/api/auth/**` (login/logout), `/api/public/**` (ezt hívja kívülről a `partiko-rendeles` — ha ide is bekerülne az auth-check, elszállna az ügyfél-rendelés).
- Bejelentkezés: `POST /api/auth/login` → cookie beállítása. Kijelentkezés: `POST /api/auth/logout` (a fejlécben lévő "Kilépés" gomb, `src/components/LogoutButton.tsx`, ami elrejti magát a `/bejelentkezes` oldalon).
- Ha megváltoztatod a jelszót/usernevet, csak a Vercel env változót kell frissíteni (`vercel env` vagy a dashboard), nincs migráció/kód-módosítás.

## Nem-nyilvánvaló üzleti szabály: Rögzítés vs. Összesítő eltérő időalapja

Ez a legfontosabb, első ránézésre hibának tűnő, de **szándékos** viselkedés:

- A **Rögzítés oldal** (`src/app/page.tsx`) az alapanyagonkénti "mióta nem lett leszámlázva" futó összeget az `entry.createdAt` alapján számolja: minden bejegyzés beleszámít, aminek a `createdAt`-je *később* van, mint az utolsó `BillingPeriod.closedAt`. Ez azt jelenti, hogy a számláló **azonnal nullázódik** a leszámlázás gombra kattintás után, függetlenül attól, hogy az adott bejegyzések melyik napra (`date`) lettek rögzítve.
- Az **Összesítő oldal** (`src/app/osszesites/`) ezzel szemben a `entry.date` mező szerinti `from`/`to` tartományban összesít (`src/lib/summary.ts`) — tehát ha valaki visszamenőleg rögzít egy korábbi napra bejegyzést, az az Összesítőben a megfelelő dátumhoz kerül, a Rögzítés oldal futó számlálójában viszont a rögzítés (nem a bejegyzés napja) dönti el, hogy "új"-nak számít-e.

Ha ezen a területen változtatsz, tudatosan válaszd ki melyik időalapot használod — ne keverd össze a kettőt "javításként".

**2026-07-06 javítás**: a Rögzítés oldal korábban csak a dátumválasztóban kijelölt egyetlen napra (`date` param) kérte le a bejegyzéseket a `GET /api/entries`-től, ezért egy korábbi nap tételei "eltűntek" a lista alól, amint másik napra váltottál. Mostantól a teljes nyitott (le nem számlázott) időszakot kéri le (`from`/`to` param, `getOpenPeriod().from`-tól máig) — a `GET /api/entries` route mindkét formát támogatja (`date` VAGY `from`+`to`). A dátumválasztó továbbra is csak azt dönti el, melyik napra kerül egy ÚJ bejegyzés; a megjelenített lista (és a fenti createdAt-szűrés) az egész nyitott időszakra vonatkozik, minden chipen dátum-címkével.

## Egyéb szándékos, nem hiba jellegű döntés

`POST /api/billing-periods` (`src/app/api/billing-periods/route.ts`) **feltétel nélkül** létrehoz egy új `BillingPeriod` sort minden hívásra — nincs guard ismételt hívás, sem üres (0 tételes) időszak lezárása ellen. Az egyetlen védelem kliensoldali: az Összesítő oldalon a gomb `disabled`, ha nincs `summary` vagy `summary.rows.length === 0`. Ha API-t közvetlenül hívnak (pl. script, teszt), duplikált vagy üres `BillingPeriod` rekord jöhet létre — ez ismert, elfogadott kompromisszum, nem hiba.

## Hibakezelés (`src/lib/apiRoute.ts`, `src/lib/validate.ts`)

Minden API route `withApiErrorHandling()`-be van csomagolva:
- Prisma `P2025` (rekord nem található) → 404 JSON `{error: "Nem található"}`
- Prisma `P2003` (foreign key hiba, pl. nem létező `ingredientId`) → 400 JSON `{error: "Érvénytelen hivatkozás"}`
- Minden más kivétel → logolva szerveroldalon, 400/500 JSON a klienshez (nincs stack trace kiszivárogtatás)

Bemenet-validáció (`isValidDateStr`, `isValidMenuDay` a `src/lib/validate.ts`-ben) minden dátum query paraméterre (`date`, `from`, `to`, `week`, `weekStart`) és a `weekly-menu` PUT `days` tömbjére. Ezek a válaszok **csak korábban kezeletlen hibaágakat** fednek le — érvényes bemenetre a viselkedés nem változott.

## Ismert buktatók

- Prisma 7-ben nincs beépített query engine bináris, csak driver adapter — ha "unknown datasource url" hibát kapsz, valószínűleg a schema.prisma-ba került vissza `url`.
- Next 16-ban a dinamikus route paraméterek (`ctx.params`) Promise-ok — mindig `await ctx.params`.
- Turbopack séma-váltás (új Prisma mező/modell) után néha nem elég a `prisma generate` — a dev szerver **teljes leállítása és újraindítása** szükséges, különben "Unknown argument" hibát dob egy elavult bundle-ből.
- CSS cascade layers: Tailwind utility osztályok `@layer utilities`-ben vannak, ezért **bármilyen unlayered plain CSS szabály felülírja őket specifikusságtól függetlenül** (ld. `globals.css`).
- HTML `<input type="number">` mindig pontot vár tizedesjelnek a böngésző locale-jától függetlenül — ezért a mennyiség mezők `type="text" inputMode="decimal"`-lel + kézi vessző→pont normalizálással működnek.

## Tesztelés

- `npm test` — Vitest, csak DB-mentes logika (`src/lib/dates.test.ts`, `src/lib/validate.test.ts`, `src/lib/weeklyMenu.test.ts`, `src/lib/generateMenuDocx.test.ts`, `src/lib/summary.test.ts`, `src/lib/billing.test.ts`, `src/lib/orders.test.ts`, `src/lib/ordersSummary.test.ts`, `src/lib/generateOrdersXlsx.test.ts`, `src/lib/cors.test.ts`, `src/lib/auth.test.ts` — a DB-t érintők `vi.mock("@/lib/db")`-vel, a `cors.test.ts`/`auth.test.ts` pedig `vi.stubEnv`-vel izolálja az env változókat).
- Helyi fejlesztéshez az `ALLOWED_ORIGINS` env változót a `.env.local`-ba érdemes tenni (pl. `http://localhost:3100` a `partiko-rendeles` dev szerveréhez) — ez **nem** kerül a megosztott `.env`-be, mert csak lokális CORS-teszteléshez kell.
- `npm run build` — TypeScript + Next.js build ellenőrzés.
- Amit **nem** fed le automatikus teszt (mert valós DB-t igényelne): API route-ok end-to-end viselkedése, `billing-periods` POST tényleges hatása, migrációk. Ezeket csak kézzel, a fent leírt öntisztogató módszerrel szabad ellenőrizni.
