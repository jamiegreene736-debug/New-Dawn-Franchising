export function replyFolders(folders: { path: string; specialUse?: string }[]): string[] {
  const all = folders.find(f => f.specialUse === "\\All");
  const extra = folders.filter(f => f.specialUse === "\\Junk" || f.specialUse === "\\Trash");
  return [...new Set([all?.path || "INBOX", ...extra.map(f => f.path)])];
}
/** Only an original Message-ID can conclusively attribute a delivery failure. */
export function originalMessageIds(raw: string): string[] {
  const parts = raw.split(/\r?\n\r?\n/);
  const body = parts.slice(1).join("\n\n");
  return [...new Set([...body.matchAll(/^(?:original-message-id|message-id):\s*(<[^>\r\n]+>)/gim)].map(m => m[1]))];
}
