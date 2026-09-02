import { pool } from "../server/db";
import { readMobileSchemaReadiness } from "../server/mobile/schema-readiness";

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    const readiness = await readMobileSchemaReadiness(client);
    console.log(JSON.stringify({
      mode: "read-only",
      generatedAt: new Date().toISOString(),
      containsPersonalData: false,
      ...readiness,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown schema readiness error";
  console.error(`[mobile-schema-readiness] ${message}`);
  process.exitCode = 1;
});
