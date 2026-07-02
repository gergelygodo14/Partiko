import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { addDaysStr } from "@/lib/dates";
import { DAY_NAMES, type MenuDay } from "@/lib/weeklyMenu";

function formatShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${month}.${day}.`;
}

function optionLine(letter: string, text: string, isGM: boolean): Paragraph {
  const value = text.trim();
  return new Paragraph({
    children: [
      new TextRun(`${letter}.${value}`),
      ...(isGM && value ? [new TextRun(" GM")] : []),
    ],
  });
}

export async function generateMenuDocx(weekStart: string, days: MenuDay[]): Promise<Buffer> {
  const weekEnd = addDaysStr(weekStart, 4);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "PARTIKO KFT. DOMASZÉK BÁLINT SÁNDOR U. 22. 6781",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "WWW.PARTIKO.HU", bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "MOB:0670 9316150   partiko@partiko.hu",
                bold: true,
              }),
            ],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, space: 8 },
            },
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Heti készétel választék: ${formatShort(weekStart)}-${formatShort(weekEnd)}`,
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          ...DAY_NAMES.flatMap((name, i) => {
            const day = days[i];
            return [
              new Paragraph({
                children: [new TextRun({ text: `${name}:`, bold: true })],
              }),
              optionLine("A", day.a, day.aGM),
              optionLine("B", day.b, day.bGM),
              optionLine("C", day.c, day.cGM),
              new Paragraph({ text: "" }),
            ];
          }),
          new Paragraph({
            text: "Tisztelt vásárlóink! A változtatás jogát fenntartjuk.",
          }),
          new Paragraph({ text: "Üdvözlettel: Godó Ferenc mesterszakács" }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
