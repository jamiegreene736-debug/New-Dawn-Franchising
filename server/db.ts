import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as coreSchema from "@shared/schema";
import * as mobileSchema from "@shared/mobile/schema";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema: { ...coreSchema, ...mobileSchema } });
