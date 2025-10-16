#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests the database connection using the same pg Pool configuration as the application
 */

const { Pool } = require('pg');
require('dotenv').config({ path: './deploy/.env.runtime' });

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

async function testConnection() {
  console.log('\n' + '='.repeat(50));
  console.log('  Node.js Database Connection Test');
  console.log('='.repeat(50) + '\n');

  // Check environment variables
  if (!process.env.DATABASE_URL) {
    log(colors.red, '✗', 'DATABASE_URL not found in environment');
    log(colors.yellow, 'ℹ', 'Make sure deploy/.env.runtime exists and contains DATABASE_URL');
    process.exit(1);
  }

  log(colors.green, '✓', 'Environment variables loaded');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`  PGPOOL_MAX: ${process.env.PGPOOL_MAX || 10}`);
  console.log(`  PGPOOL_IDLE_MS: ${process.env.PGPOOL_IDLE_MS || 10000}`);
  console.log(`  PGSSL_DISABLE: ${process.env.PGSSL_DISABLE || '0'}`);
  console.log('');

  // Create pool with same configuration as application
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 10_000),
    ssl: process.env.PGSSL_DISABLE === '1' ? undefined : { rejectUnauthorized: true },
  });

  // Set up error handler
  pool.on('error', (err) => {
    log(colors.red, '✗', `Pool error: ${err.message}`);
  });

  pool.on('connect', () => {
    log(colors.blue, 'ℹ', 'New client connected to pool');
  });

  console.log('Test 1: Basic Connection');
  try {
    const client = await pool.connect();
    log(colors.green, '✓', 'Successfully connected to database');

    // Test query
    console.log('\nTest 2: Simple Query');
    const result = await client.query('SELECT NOW() as current_time, current_database() as database, current_user as user');
    log(colors.green, '✓', 'Query executed successfully');
    console.log('  Result:', result.rows[0]);

    // Test application_name setting
    console.log('\nTest 3: Application Name');
    await client.query("SET application_name = 'vinops.api.v1'");
    const appNameResult = await client.query('SHOW application_name');
    log(colors.green, '✓', `Application name set to: ${appNameResult.rows[0].application_name}`);

    // Test session timeouts
    console.log('\nTest 4: Session Timeouts');
    const stmtMs = Number(process.env.PG_STMT_MS || 0);
    const idleTx = Number(process.env.PG_IDLE_TX_MS || 3000);

    await client.query(`SET idle_in_transaction_session_timeout = ${idleTx}`);
    if (stmtMs > 0) {
      await client.query(`SET statement_timeout = ${stmtMs}`);
    }
    log(colors.green, '✓', `Idle transaction timeout: ${idleTx}ms`);
    if (stmtMs > 0) {
      log(colors.green, '✓', `Statement timeout: ${stmtMs}ms`);
    }

    // Test table access
    console.log('\nTest 5: Schema Access');
    try {
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      log(colors.green, '✓', `Found ${tables.rows.length} tables in public schema`);
      if (tables.rows.length > 0) {
        console.log('  Tables:');
        tables.rows.forEach(row => console.log(`    - ${row.table_name}`));
      }
    } catch (err) {
      log(colors.yellow, '⚠', `Limited table access: ${err.message}`);
    }

    // Test connection pool
    console.log('\nTest 6: Connection Pool');
    const connections = [];
    for (let i = 0; i < 3; i++) {
      const conn = await pool.connect();
      connections.push(conn);
      log(colors.green, '✓', `Pool connection ${i + 1}/3 established`);
    }

    // Release connections
    connections.forEach(conn => conn.release());
    log(colors.green, '✓', 'All pool connections released');

    // Release initial client
    client.release();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('  All Tests Passed!');
    console.log('='.repeat(50) + '\n');

    log(colors.green, '✓', 'Database connection is stable and ready');
    console.log('\nConnection Pool Stats:');
    console.log(`  Total clients: ${pool.totalCount}`);
    console.log(`  Idle clients: ${pool.idleCount}`);
    console.log(`  Waiting requests: ${pool.waitingCount}`);

    await pool.end();
    process.exit(0);

  } catch (err) {
    log(colors.red, '✗', `Connection failed: ${err.message}`);
    console.log('\nError Details:');
    console.log(err);

    console.log('\n' + colors.yellow + 'Action Required:' + colors.reset);
    console.log('If you see "permission denied for database":');
    console.log('  1. Contact your hosting provider');
    console.log('  2. Ask them to run: GRANT CONNECT ON DATABASE vinops_db TO gen_user;');
    console.log('  3. Verify the database name is correct');

    await pool.end();
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  log(colors.red, '✗', `Unhandled rejection: ${err.message}`);
  process.exit(1);
});

// Run the test
testConnection();
