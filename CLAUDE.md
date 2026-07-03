@AGENTS.md

# Partiko

Belső alapanyag-rendelés-nyilvántartó és heti menü szerkesztő a Partiko Kft. (gyorsétterem-alapanyag beszállító) számára. Kis, megbízható felhasználói kör (a család) használja telefonról — nincs autentikáció, ez tudatos döntés, nem hiányosság.

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
- **`WeeklyMenu`** — egy hét (`weekStart`, mindig hétfő) A/B/C menüje `days` JSON mezőben (5 elemű tömb, mezőnként `a/b/c` string + `aGM/bGM/cGM` boolean a gluténmentes jelöléshez).

## Nem-nyilvánvaló üzleti szabály: Rögzítés vs. Összesítő eltérő időalapja

Ez a legfontosabb, első ránézésre hibának tűnő, de **szándékos** viselkedés:

- A **Rögzítés oldal** (`src/app/page.tsx`) az alapanyagonkénti "mióta nem lett leszámlázva" futó összeget az `entry.createdAt` alapján számolja: minden bejegyzés beleszámít, aminek a `createdAt`-je *később* van, mint az utolsó `BillingPeriod.closedAt`. Ez azt jelenti, hogy a számláló **azonnal nullázódik** a leszámlázás gombra kattintás után, függetlenül attól, hogy az adott bejegyzések melyik napra (`date`) lettek rögzítve.
- Az **Összesítő oldal** (`src/app/osszesites/`) ezzel szemben a `entry.date` mező szerinti `from`/`to` tartományban összesít (`src/lib/summary.ts`) — tehát ha valaki visszamenőleg rögzít egy korábbi napra bejegyzést, az az Összesítőben a megfelelő dátumhoz kerül, a Rögzítés oldal futó számlálójában viszont a rögzítés (nem a bejegyzés napja) dönti el, hogy "új"-nak számít-e.

Ha ezen a területen változtatsz, tudatosan válaszd ki melyik időalapot használod — ne keverd össze a kettőt "javításként".

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

- `npm test` — Vitest, csak DB-mentes logika (`src/lib/dates.test.ts`, `src/lib/validate.test.ts`, `src/lib/weeklyMenu.test.ts`, `src/lib/generateMenuDocx.test.ts`, `src/lib/summary.test.ts`, `src/lib/billing.test.ts` — utóbbi kettő `vi.mock("@/lib/db")`-vel).
- `npm run build` — TypeScript + Next.js build ellenőrzés.
- Amit **nem** fed le automatikus teszt (mert valós DB-t igényelne): API route-ok end-to-end viselkedése, `billing-periods` POST tényleges hatása, migrációk. Ezeket csak kézzel, a fent leírt öntisztogató módszerrel szabad ellenőrizni.
