import { ImapFlow, type ImapFlowOptions } from "imapflow";

function logImapError(context: string, phase: string, error: unknown): void {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  // Provider errors can contain authentication details or message contents.
  console.error(`[IMAP] ${context} ${phase}`, {
    code: typeof code === "string" && /^[A-Za-z0-9_]{1,64}$/.test(code) ? code : "IMAP_ERROR",
  });
}

export function createImapClient(options: ImapFlowOptions, context: string): ImapFlow {
  const client = new ImapFlow({
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    ...options,
  });
  // Promise catches do not handle EventEmitter errors, including delayed errors
  // from AUTHENTICATE after connect() has already timed out. Keep this listener
  // attached through close so those errors cannot terminate the web server.
  client.on("error", (error) => logImapError(context, "connection error", error));
  return client;
}

export async function closeImapClient(client: ImapFlow, context: string): Promise<void> {
  try {
    // A failed or incomplete login has no usable session to log out of.
    if (client.usable) await client.logout();
  } catch (error) {
    logImapError(context, "logout error", error);
  } finally {
    client.close();
  }
}
