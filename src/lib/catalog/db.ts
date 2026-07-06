import { Pool } from "pg";

let pool: Pool | undefined;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for PostgreSQL catalog access.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    });
  }

  return pool;
}

export async function closePoolForTests(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
