import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var prismaAdapter: PrismaPg | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL manquante");
}

function createPoolConfig(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      ssl:
        databaseUrl.includes("supabase.com")
          ? {
              rejectUnauthorized: false
            }
          : undefined
    };
  } catch {
    return {
      connectionString: databaseUrl,
      ssl:
        databaseUrl.includes("supabase.com")
          ? {
              rejectUnauthorized: false
            }
          : undefined
    };
  }
}

const pool =
  global.pgPool ??
  new Pool(createPoolConfig(connectionString));

const adapter = global.prismaAdapter ?? new PrismaPg(pool);

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
  global.pgPool = pool;
  global.prismaAdapter = adapter;
}
