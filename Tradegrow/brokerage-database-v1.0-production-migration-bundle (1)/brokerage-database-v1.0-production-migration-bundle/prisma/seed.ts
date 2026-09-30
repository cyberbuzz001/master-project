import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.exchange.upsert({
    where: { code: 'NSE' },
    update: {},
    create: { code: 'NSE', name: 'National Stock Exchange of India' }
  });
  await prisma.exchange.upsert({
    where: { code: 'BSE' },
    update: {},
    create: { code: 'BSE', name: 'BSE Limited' }
  });
  console.log('Reference seed complete.');
}

main().catch(async e => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
