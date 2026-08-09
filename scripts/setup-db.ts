// ==============================================================================
// Sculra Database Provisioning Script (scripts/setup-db.ts)
// ==============================================================================
// Used to verify local DB connectivity, apply schema definitions, and run healthchecks.

import { Client } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:54322/postgres';
  console.log(`Connecting to database at: ${dbUrl}`);

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Successfully connected to database.');

    // Query to check existing tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Existing tables:');
    res.rows.forEach(row => console.log(` - ${row.table_name}`));

  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}

