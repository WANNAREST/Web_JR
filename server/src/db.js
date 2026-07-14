import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const requestedPoolSize = Number(process.env.DATABASE_POOL_SIZE ?? 5);
const poolSize = Number.isInteger(requestedPoolSize) && requestedPoolSize > 0
  ? Math.min(requestedPoolSize, 20)
  : 5;
const ssl = process.env.DATABASE_SSL === "disable"
  ? false
  : { rejectUnauthorized: true };

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl,
      max: poolSize,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000
    })
  : null;

if (pool) {
  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error", error);
  });
}

export function isDatabaseConfigured() {
  return Boolean(pool);
}

export async function checkDatabase() {
  if (!pool) return false;
  try {
    const result = await pool.query("SELECT to_regclass('public.terms') IS NOT NULL AS ready");
    return result.rows[0]?.ready === true;
  } catch {
    return false;
  }
}

export async function query(text, values = []) {
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool.query(text, values);
}

export async function withTransaction(callback) {
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
