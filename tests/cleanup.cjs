/**
 * Cleanup Script — Deletes all seed data from the database.
 * Run BEFORE re-seeding to ensure clean state.
 * Usage: node cleanup.cjs
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const dbToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !dbToken) {
    console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env');
    process.exit(1);
  }

  const db = createClient({ url: dbUrl, authToken: dbToken });

  console.log('Clearing all seed data...\n');

  // Delete in order of dependencies
  console.log('  Deleting registrations...');
  await db.execute('DELETE FROM registrations');

  console.log('  Deleting swipes...');
  await db.execute('DELETE FROM swipes');

  console.log('  Deleting chats...');
  await db.execute('DELETE FROM chats');

  console.log('  Deleting parties...');
  await db.execute('DELETE FROM parties');

  console.log('  Deleting sessions...');
  await db.execute('DELETE FROM sessions');

  console.log('  Deleting users...');
  await db.execute('DELETE FROM users');

  console.log('\n✅ All seed data cleared.');
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
