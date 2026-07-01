import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const ingredients = [
  { name: "Csirkeszárny", unit: "kg", unitPrice: 1350 },
  { name: "Csirkemell", unit: "kg", unitPrice: 2450 },
  { name: "Jégsaláta", unit: "kg", unitPrice: 350 },
  { name: "Paradicsom", unit: "kg", unitPrice: 1280 },
  { name: "Panír", unit: "kg", unitPrice: 500 },
  { name: "Olvasztott sajt", unit: "kg", unitPrice: 2500 },
  { name: "Chiliszósz", unit: "kg", unitPrice: 1500 },
  { name: "Sajtszósz", unit: "kg", unitPrice: 2300 },
  { name: "Bacon", unit: "kg", unitPrice: 7000 },
  { name: "Barbecue szósz", unit: "kg", unitPrice: 1600 },
  { name: "Fokhagymás majonéz", unit: "kg", unitPrice: 800 },
  { name: "Marha", unit: "kg", unitPrice: 3100 },
  { name: "Smash", unit: "kg", unitPrice: 360 },
];

async function main() {
  for (const ingredient of ingredients) {
    const existing = await prisma.ingredient.findFirst({
      where: { name: ingredient.name },
    });
    if (!existing) {
      await prisma.ingredient.create({ data: ingredient });
    }
  }
  console.log(`Seed kész: ${ingredients.length} alapanyag ellenőrizve.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
