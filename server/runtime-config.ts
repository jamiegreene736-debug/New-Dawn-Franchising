type Environment = Readonly<Record<string, string | undefined>>;

export function readRequiredEnvironmentValue(
  name: string,
  environment: Environment = process.env,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`[config] Required environment variable ${name} is missing`);
  }

  return value;
}
