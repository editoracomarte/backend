export default async function globalTeardown(): Promise<void> {
  // Strapi cleanup is handled per-suite via afterAll(cleanupStrapi).
  // This hook exists for parity with global-setup and future global cleanup needs.
}
