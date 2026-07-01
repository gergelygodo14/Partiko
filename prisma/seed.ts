import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ingredients = [
  { name: "Csirkemell", unit: "kg", unitPrice: 2450, order: 1 },
  { name: "Csirkeszárny", unit: "kg", unitPrice: 1350, order: 2 },
  { name: "Fasírt", unit: "db", unitPrice: 380, order: 3 },
  { name: "Smash", unit: "db", unitPrice: 360, order: 4 },
  { name: "Marha", unit: "kg", unitPrice: 3100, order: 5 },
  { name: "Bacon", unit: "kg", unitPrice: 7000, order: 6 },
  { name: "Rántott sajt", unit: "kg", unitPrice: 2500, order: 7 },
  { name: "Sajtszósz", unit: "kg", unitPrice: 2300, order: 8 },
  { name: "Chiliszósz", unit: "kg", unitPrice: 1500, order: 9 },
  { name: "Barbecue szósz", unit: "kg", unitPrice: 1600, order: 10 },
  { name: "Fokhagymás majonéz", unit: "kg", unitPrice: 800, order: 11 },
  { name: "Panír", unit: "kg", unitPrice: 500, order: 12 },
  { name: "Jégsaláta", unit: "db", unitPrice: 350, order: 13 },
  { name: "Paradicsom", unit: "kg", unitPrice: 1280, order: 14 },
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
