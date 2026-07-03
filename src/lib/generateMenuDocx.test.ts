import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateMenuDocx } from "@/lib/generateMenuDocx";
import { emptyWeek } from "@/lib/weeklyMenu";

async function readDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("document.xml missing from docx archive");
  return file.async("string");
}

describe("generateMenuDocx", () => {
  it("produces a valid docx (zip) buffer", async () => {
    const buffer = await generateMenuDocx("2026-06-29", emptyWeek());
    // ZIP local file header magic bytes: "PK\x03\x04"
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    await expect(readDocumentXml(buffer)).resolves.toContain("w:document");
  });

  it("includes the dish names and GM marker in the document text", async () => {
    const days = emptyWeek();
    days[0] = {
      a: "Rántott sajt",
      aGM: false,
      b: "Grillcsirke",
      bGM: true,
      c: "Rakott karfiol",
      cGM: false,
    };
    const buffer = await generateMenuDocx("2026-06-29", days);
    const xml = await readDocumentXml(buffer);

    expect(xml).toContain("Rántott sajt");
    expect(xml).toContain("Grillcsirke");
    expect(xml).toContain("Rakott karfiol");
    expect(xml).toContain("GM");
    expect(xml).toContain("HÉTFŐ");
  });

  it("formats the week range in the heading", async () => {
    const buffer = await generateMenuDocx("2026-06-29", emptyWeek());
    const xml = await readDocumentXml(buffer);
    expect(xml).toContain("06.29.-07.03.");
  });
});
