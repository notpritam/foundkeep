/** Shared allowlist for console access and operator-only notifications. */
export function adminEmails(): Set<string> {
  return new Set((process.env.FOUNDKEEP_ADMIN_EMAILS ?? 'notpritamsharma@gmail.com')
    .split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
}
export const isAdminEmail = (email: string): boolean => adminEmails().has(email.trim().toLowerCase());
