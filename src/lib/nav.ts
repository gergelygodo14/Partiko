import { createHash, randomBytes } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { gunzipSync } from "zlib";

// NAV Online Számla (Hungarian real-time invoice reporting system), read-only
// client - queries invoices where Partiko is the BUYER ("inbound"), issued
// by suppliers (Sajtfutár, Baromfiudvar), to replace manual photo upload in
// the Számlák module. 2026-09-06/07.
//
// Verified against the official spec (nav-gov-hu/Online-Invoice GitHub repo,
// docs/API docs/hu/Online_Szamla_interfesz specifikacio_HU_v3.0.pdf) before
// writing any of this - re-check that doc if resuming much later, NAV
// updates it periodically and a wrong signature algorithm fails silently
// with an unhelpful auth error.
//
// Deliberately does NOT implement /manageInvoice (issuing our own invoices)
// or /tokenExchange - neither is needed for querying, and tokenExchange's
// AES-128-ECB/cserekulcs machinery only matters for that submission flow.
// See project_partiko_nav_integration.md memory for the full research trail.

const NAV_API_BASE = process.env.NAV_API_BASE ?? "https://api.onlineszamla.nav.gov.hu";
const REQUEST_VERSION = "3.0";
const HEADER_VERSION = "1.0";

// 18-char [0-9A-Z]{18} per spec §"A softwareId az adott számlázó program
// azonosítására szolgáló 18 elemű karaktersorozat" - HU country prefix per
// NAV's own naming recommendation, rest is an arbitrary fixed id for this
// app (must stay stable across calls/versions, not regenerated per request).
const SOFTWARE_ID = "HUPARTIKOAPP000001";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** yyyyMMddHHmmss in UTC, no separators - the exact mask requestSignature's
 *  timestamp component uses (spec §1.5.2), distinct from the header's own
 *  ISO 8601 timestamp. Exported for unit testing against a known Date. */
export function compactUtcTimestamp(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds())
  );
}

/** [+a-zA-Z0-9_]{1,30}, must be unique per taxpayer within the timestamp's
 *  +-1 day tolerance window - timestamp-derived prefix plus random suffix is
 *  ample entropy for that. */
function generateRequestId(): string {
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `PARTIKO${Date.now().toString(36).toUpperCase()}${rand}`.slice(0, 30);
}

/** passwordHash = uppercase SHA-512 of the literal password (spec §1.4-2).
 *  Exported for unit testing. */
export function computePasswordHash(password: string): string {
  return createHash("sha512").update(password, "utf8").digest("hex").toUpperCase();
}

/** requestSignature for every operation EXCEPT manageInvoice/manageAnnulment
 *  (spec §1.5.2 - those two have a different, index-hash-based formula we
 *  don't need since this client never submits invoices) = uppercase SHA3-512
 *  of requestId + compact UTC timestamp + the signKey's literal value,
 *  concatenated in that exact order. Verified live 2026-09-07 against the
 *  real production API with real credentials (see
 *  project_partiko_nav_integration.md memory) - a wrong concatenation order
 *  or hash algorithm here fails auth silently with an unhelpful error, so
 *  this having actually authenticated is the real proof, not just the spec
 *  reading. Exported for unit testing. */
export function computeRequestSignature(requestId: string, timestamp: Date, signKey: string): string {
  return createHash("sha3-512")
    .update(requestId + compactUtcTimestamp(timestamp) + signKey, "utf8")
    .digest("hex")
    .toUpperCase();
}

type NavCredentials = {
  login: string;
  password: string;
  signKey: string;
  taxNumber: string;
};

function getCredentials(): NavCredentials {
  const login = process.env.NAV_TECHNICAL_USER_LOGIN;
  const password = process.env.NAV_TECHNICAL_USER_PASSWORD;
  const signKey = process.env.NAV_SIGN_KEY;
  const taxNumber = process.env.NAV_TAXPAYER_NUMBER;
  if (!login || !password || !signKey || !taxNumber) {
    throw new Error(
      "NAV technikai felhasználó adatai hiányosak (NAV_TECHNICAL_USER_LOGIN / NAV_TECHNICAL_USER_PASSWORD / NAV_SIGN_KEY / NAV_TAXPAYER_NUMBER)"
    );
  }
  return { login, password, signKey, taxNumber };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The <common:header>/<common:user>/<software> block every operation needs,
 *  built fresh per call (requestId/timestamp/signature must all be unique
 *  and matched to each other). */
function buildAuthBlock(creds: NavCredentials): string {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.(\d{3})\d*Z$/, ".$1Z"); // ms precision, matches spec samples
  const requestSignature = computeRequestSignature(requestId, now, creds.signKey);
  const passwordHash = computePasswordHash(creds.password);

  return `<common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>${REQUEST_VERSION}</common:requestVersion>
    <common:headerVersion>${HEADER_VERSION}</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${creds.login}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${creds.taxNumber}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${SOFTWARE_ID}</softwareId>
    <softwareName>Partiko</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Godo Gergely</softwareDevName>
    <softwareDevContact>${xmlEscape("gergelygodo14@gmail.com")}</softwareDevContact>
    <softwareDevCountryCode>HU</softwareDevCountryCode>
    <softwareDevTaxNumber>${creds.taxNumber}</softwareDevTaxNumber>
  </software>`;
}

export type NavApiError = { code: string; message: string };

/** Every response root carries a <result> with funcCode OK/ERROR - checked
 *  uniformly here so callers only ever see either parsed data or a thrown,
 *  readable error. */
function checkResult(parsed: Record<string, unknown>, rootTag: string): Record<string, unknown> {
  const root = parsed[rootTag] as Record<string, unknown> | undefined;
  if (!root) {
    throw new Error(`Váratlan NAV válasz: nincs <${rootTag}> gyökérelem`);
  }
  const result = root.result as Record<string, unknown> | undefined;
  const funcCode = result?.funcCode;
  if (funcCode !== "OK") {
    const errorCode = result?.errorCode ?? "ISMERETLEN";
    const message = result?.message ?? "Nincs részletes hibaüzenet";
    throw new Error(`NAV API hiba (${errorCode}): ${message}`);
  }
  return root;
}

async function navPost(operation: string, bodyInner: string, requestRoot: string): Promise<Record<string, unknown>> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${requestRoot} xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common" xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  ${bodyInner}
</${requestRoot}>`;

  const res = await fetch(`${NAV_API_BASE}/invoiceService/v3/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/xml; charset=UTF-8", Accept: "application/xml" },
    body: xml,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`NAV API HTTP ${res.status} (${operation}): ${text.slice(0, 2000)}`);
  }
  const parsed = xmlParser.parse(text) as Record<string, unknown>;
  const responseRoot = `${requestRoot.replace(/Request$/, "Response")}`;
  return checkResult(parsed, responseRoot);
}

export type InboundInvoiceDigest = {
  invoiceNumber: string;
  invoiceDirection: "INBOUND" | "OUTBOUND";
  supplierName: string | null;
  supplierTaxNumber: string | null;
  issueDate: string;
  // The digest has no single "gross" field (verified live 2026-09-07) - just
  // net and VAT separately; gross = net + vat when both are present.
  invoiceNetAmountHUF: number | null;
  invoiceVatAmountHUF: number | null;
};

/** Lists invoices issued TO Partiko by suppliers (invoiceDirection=INBOUND),
 *  in the given issue-date range - the mandatory query param, per spec. Page
 *  1-based; NAV caps each page (typically 100 rows), so a caller sweeping a
 *  wide range should loop until availablePage is exhausted. */
export async function queryInvoiceDigest(params: {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  page?: number;
}): Promise<{ invoices: InboundInvoiceDigest[]; currentPage: number; availablePage: number }> {
  const creds = getCredentials();
  const page = params.page ?? 1;

  const body = `${buildAuthBlock(creds)}
  <page>${page}</page>
  <invoiceDirection>INBOUND</invoiceDirection>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <dateFrom>${params.dateFrom}</dateFrom>
        <dateTo>${params.dateTo}</dateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
  </invoiceQueryParams>`;

  const root = await navPost("queryInvoiceDigest", body, "QueryInvoiceDigestRequest");
  const digestResult = root.invoiceDigestResult as Record<string, unknown> | undefined;
  const currentPage = Number(digestResult?.currentPage ?? page);
  const availablePage = Number(digestResult?.availablePage ?? currentPage);

  const rawDigests = digestResult?.invoiceDigest;
  const digestList = Array.isArray(rawDigests) ? rawDigests : rawDigests ? [rawDigests] : [];

  const invoices: InboundInvoiceDigest[] = digestList.map((d: Record<string, unknown>) => ({
    invoiceNumber: String(d.invoiceNumber),
    invoiceDirection: (d.invoiceDirection as "INBOUND" | "OUTBOUND") ?? "INBOUND",
    supplierName: d.supplierName !== undefined ? String(d.supplierName) : null,
    supplierTaxNumber: d.supplierTaxNumber !== undefined ? String(d.supplierTaxNumber) : null,
    issueDate: String(d.invoiceIssueDate),
    invoiceNetAmountHUF: d.invoiceNetAmountHUF !== undefined ? Number(d.invoiceNetAmountHUF) : null,
    invoiceVatAmountHUF: d.invoiceVatAmountHUF !== undefined ? Number(d.invoiceVatAmountHUF) : null,
  }));

  return { invoices, currentPage, availablePage };
}

export type NavInvoiceLineItem = {
  lineNumber: number;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitPriceHUF: number | null;
  lineNetAmountHUF: number | null;
};

export type NavInvoiceData = {
  invoiceNumber: string;
  issueDate: string | null;
  supplierName: string | null;
  lines: NavInvoiceLineItem[];
};

/** Fetches one invoice's full line-item data by number. invoiceData comes
 *  back BASE64 (optionally gzip per compressedContentIndicator) - decoded
 *  and re-parsed as its own XML document (the NAV-defined InvoiceType
 *  schema, distinct from the outer API envelope). No AES step - that's only
 *  for /manageInvoice's exchangeToken, not this response (verified live). */
export async function queryInvoiceData(
  invoiceNumber: string,
  direction: "INBOUND" | "OUTBOUND" = "INBOUND"
): Promise<NavInvoiceData> {
  const creds = getCredentials();

  const body = `${buildAuthBlock(creds)}
  <invoiceNumberQuery>
    <invoiceNumber>${xmlEscape(invoiceNumber)}</invoiceNumber>
    <invoiceDirection>${direction}</invoiceDirection>
  </invoiceNumberQuery>`;

  const root = await navPost("queryInvoiceData", body, "QueryInvoiceDataRequest");
  const dataResult = root.invoiceDataResult as Record<string, unknown> | undefined;
  if (!dataResult) {
    throw new Error(`A(z) ${invoiceNumber} számú számla nem található (vagy nem a mi oldalunkon szerepel)`);
  }

  const base64 = String(dataResult.invoiceData);
  const compressed = String(dataResult.compressedContentIndicator).toLowerCase() === "true";
  let raw = Buffer.from(base64, "base64");
  if (compressed) raw = gunzipSync(raw);
  const invoiceXml = raw.toString("utf8");

  const parsedInvoice = xmlParser.parse(invoiceXml) as Record<string, unknown>;
  // InvoiceType structure (verified live 2026-09-07 against a real
  // Baromfiudvar invoice): root is <InvoiceData>, with invoiceIssueDate as
  // its own direct child (a sibling of invoiceMain, NOT nested under
  // invoiceHead) - a modification document uses <Invoice> instead, same
  // shape below that.
  const invoiceRoot = (parsedInvoice.InvoiceData ?? parsedInvoice.Invoice) as Record<string, unknown>;
  const main = invoiceRoot?.invoiceMain as Record<string, unknown> | undefined;
  const invoiceBody = (main?.invoice ?? main) as Record<string, unknown> | undefined;
  const head = invoiceBody?.invoiceHead as Record<string, unknown> | undefined;
  const supplierInfo = head?.supplierInfo as Record<string, unknown> | undefined;
  const linesNode = invoiceBody?.invoiceLines as Record<string, unknown> | undefined;
  const rawLines = linesNode?.line;
  const lineList = Array.isArray(rawLines) ? rawLines : rawLines ? [rawLines] : [];

  const lines: NavInvoiceLineItem[] = lineList.map((l: Record<string, unknown>) => {
    const netAmountData = l.lineAmountsNormal as Record<string, unknown> | undefined;
    const netAmount = netAmountData?.lineNetAmountData as Record<string, unknown> | undefined;
    return {
      lineNumber: Number(l.lineNumber ?? 0),
      description: (l.lineDescription as string) ?? null,
      quantity: l.quantity !== undefined ? Number(l.quantity) : null,
      unit: (l.unitOfMeasureOwn as string) ?? (l.unitOfMeasure as string) ?? null,
      unitPriceHUF: l.unitPriceHUF !== undefined ? Number(l.unitPriceHUF) : null,
      lineNetAmountHUF: netAmount?.lineNetAmountHUF !== undefined ? Number(netAmount.lineNetAmountHUF) : null,
    };
  });

  return {
    invoiceNumber,
    issueDate: (invoiceRoot?.invoiceIssueDate as string) ?? null,
    supplierName: (supplierInfo?.supplierName as string) ?? null,
    lines,
  };
}
