import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { addDaysStr } from "@/lib/dates";
import { DAY_NAMES, type MenuDay } from "@/lib/weeklyMenu";

const LETTERHEAD_FONT = "Times New Roman";
const LETTERHEAD_SIZE = 20; // 10pt
const BODY_FONT = "Comic Sans MS";
const BODY_SIZE = 28; // 14pt

function formatShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${month}.${day}.`;
}

function optionLine(letter: string, text: string, isGM: boolean): Paragraph {
  const value = text.trim();
  return new Paragraph({
    children: [
      new TextRun({ text: `${letter}.${value}`, font: BODY_FONT, size: BODY_SIZE, bold: true }),
      ...(isGM && value
        ? [new TextRun({ text: " GM", font: BODY_FONT, size: BODY_SIZE, bold: true })]
        : []),
    ],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: BODY_FONT, size: BODY_SIZE, bold: true })],
  });
}

export async function generateMenuDocx(weekStart: string, days: MenuDay[]): Promise<Buffer> {
  const weekEnd = addDaysStr(weekStart, 4);
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const logoData = fs.readFileSync(logoPath);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: "png",
                data: logoData,
                transformation: { width: 97, height: 107 },
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "PARTIKO KFT. DOMASZÉK BÁLINT SÁNDOR U. 22. 6781",
                bold: true,
                font: LETTERHEAD_FONT,
                size: LETTERHEAD_SIZE,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "WWW.PARTIKO.HU",
                bold: true,
                font: LETTERHEAD_FONT,
                size: LETTERHEAD_SIZE,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "MOB:0670 9316150   partiko@partiko.hu",
                bold: true,
                font: LETTERHEAD_FONT,
                size: LETTERHEAD_SIZE,
              }),
            ],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, space: 8 },
            },
          }),
          new Paragraph({ text: "" }),
          bodyParagraph(
            `Heti készétel választék: ${formatShort(weekStart)}-${formatShort(weekEnd)}`
          ),
          new Paragraph({ text: "" }),
          ...DAY_NAMES.flatMap((name, i) => {
            const day = days[i];
            return [
              bodyParagraph(`${name}:`),
              optionLine("A", day.a, day.aGM),
              optionLine("B", day.b, day.bGM),
              optionLine("C", day.c, day.cGM),
              new Paragraph({ text: "" }),
            ];
          }),
          bodyParagraph("Tisztelt vásárlóink! A változtatás jogát fenntartjuk."),
          bodyParagraph("Üdvözlettel: Godó Ferenc mesterszakács"),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
