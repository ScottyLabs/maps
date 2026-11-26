import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

// kennel hands out unix-socket URLs (postgresql:///db?host=/run/...),
// which node-postgres does not parse; split the socket dir out by hand.
const socketUrl = databaseUrl.match(/^postgresql:\/\/(?:[^@/]*@)?\/([^?]+)\?host=(.+)$/u);

const adapter = socketUrl
  ? new PrismaPg({ database: socketUrl[1], host: socketUrl[2] })
  : new PrismaPg({ connectionString: databaseUrl });

export const prisma = new PrismaClient({ adapter });
