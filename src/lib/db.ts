import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function createDatabase() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }),
  });
}
export const db = globalDb.prisma ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
export const isDemo = () =>
  process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;
