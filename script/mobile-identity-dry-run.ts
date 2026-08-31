import { pool } from "../server/db";
import { runMobileIdentityQualityDryRun } from "../server/mobile/identity-quality";

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    const quality = await runMobileIdentityQualityDryRun(client);
    console.log(JSON.stringify({
      mode: "read-only",
      generatedAt: new Date().toISOString(),
      containsPersonalData: false,
      quality,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown dry-run error";
  console.error(`[mobile-identity-dry-run] ${message}`);
  process.exitCode = 1;
});
