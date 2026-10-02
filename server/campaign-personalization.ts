import { greetingName } from "./drip-scheduling";

export function makePersonalize(name: string, email: string, firmHook: string) {
  const { firstName, fullName } = greetingName(name || "");
  return (s: string | null | undefined): string =>
    (s || "")
      .replace(/\[Contact First Name\]/gi, firstName)
      .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
      .replace(/\{\{\s*name\s*\}\}/gi, fullName)
      .replace(/\{\{\s*email\s*\}\}/gi, email || "")
      .replace(/\{\{\s*firmHook\s*\}\}/gi, firmHook || "");
}
