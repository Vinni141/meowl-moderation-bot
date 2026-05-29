export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getAdminUserIds(): Set<string> {
  return new Set(
    getRequiredEnv('ADMIN_USER_IDS')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}
