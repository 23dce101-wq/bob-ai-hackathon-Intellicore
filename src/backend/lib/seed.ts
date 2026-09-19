// Automatic sample data seeding disabled. Existing MongoDB vessel data is the sole source of truth.
export async function seedVesselsIfEmpty(): Promise<void> {
  // Intentionally no-op to preserve user's existing MongoDB vessel data.
}
