import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import { setImmediate as nextTurn } from "node:timers/promises";
import test from "node:test";
import { createImapClient, closeImapClient } from "../server/imap-client";

const options = { host: "127.0.0.1", port: 143, logger: false as const };

test("connection errors before and after cleanup are handled without logging secrets", async (t) => {
  const logs = t.mock.method(console, "error", () => {});
  const client = createImapClient(options, "test");
  const error = Object.assign(new Error("provider response with secret-password"), { code: "NoConnection" });
  assert.doesNotThrow(() => client.emit("error", error));
  await closeImapClient(client, "test");
  await nextTurn();
  assert.doesNotThrow(() => client.emit("error", error));
  assert.equal(logs.mock.callCount(), 2);
  assert.deepEqual(logs.mock.calls[0].arguments, ["[IMAP] test connection error", { code: "NoConnection" }]);
  assert.doesNotMatch(JSON.stringify(logs.mock.calls), /secret-password/);
});

test("incomplete login closes the transport without sending LOGOUT", async (t) => {
  const client = createImapClient(options, "test");
  const logout = t.mock.method(client, "logout", async () => {});
  const close = t.mock.method(client, "close", () => {});
  await closeImapClient(client, "test");
  assert.equal(logout.mock.callCount(), 0);
  assert.equal(close.mock.callCount(), 1);
});

test("usable connections log out before closing", async (t) => {
  const client = createImapClient(options, "test");
  client.usable = true;
  const calls: string[] = [];
  t.mock.method(client, "logout", async () => { calls.push("logout"); });
  t.mock.method(client, "close", () => { calls.push("close"); });
  await closeImapClient(client, "test");
  assert.deepEqual(calls, ["logout", "close"]);
});

test("logout failure still closes and handles delayed connection errors", async (t) => {
  const logs = t.mock.method(console, "error", () => {});
  const client = createImapClient(options, "test");
  client.usable = true;
  t.mock.method(client, "logout", async () => {
    throw Object.assign(new Error("socket failed"), { code: "ECONNRESET" });
  });
  const close = t.mock.method(client, "close", () => {
    setImmediate(() => client.emit("error", Object.assign(new Error("closed"), { code: "NoConnection" })));
  });
  await closeImapClient(client, "test");
  await nextTurn();
  assert.equal(close.mock.callCount(), 1);
  assert.equal(logs.mock.callCount(), 2);
});

for (const mode of ["timeout", "authentication-rejected"] as const) {
  test(`real IMAP ${mode} rejects connect and cleans up without an uncaught error`, { timeout: 5000 }, async (t) => {
    t.mock.method(console, "error", () => {});
    const sockets = new Set<Socket>();
    let authAttempted = false;
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.write("* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN] Test server ready\r\n");
      let pending = "";
      socket.on("data", (data) => {
        pending += data.toString();
        while (pending.includes("\r\n")) {
          const end = pending.indexOf("\r\n");
          const line = pending.slice(0, end);
          pending = pending.slice(end + 2);
          const [tag, command] = line.split(" ");
          if (command === "CAPABILITY") {
            socket.write(`* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n${tag} OK capability\r\n`);
          } else if (command === "AUTHENTICATE") {
            authAttempted = true;
            if (mode === "authentication-rejected") socket.write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
          }
        }
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const client = createImapClient({
      ...options,
      port: address.port,
      secure: false,
      doSTARTTLS: false,
      auth: { user: "test@example.com", pass: "test-only-password" },
      socketTimeout: 100,
      greetingTimeout: 1000,
      connectionTimeout: 1000,
    }, "test");
    try {
      await assert.rejects(client.connect(), mode === "timeout" ? { code: "ETIMEOUT" } : { authenticationFailed: true });
      assert.equal(authAttempted, true);
      await closeImapClient(client, "test");
      // The production crash happened asynchronously after the connect rejection.
      await nextTurn();
      await nextTurn();
      assert.equal(client.usable, false);
    } finally {
      client.close();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
}
