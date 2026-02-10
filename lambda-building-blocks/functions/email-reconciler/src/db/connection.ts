/**
 * MySQL Database Connection Pool
 */

import mysql from 'mysql2/promise';
import { DatabaseConfig, TransactionCallback } from '../types';
import { logger } from '../logger';

let pool: mysql.Pool | null = null;

/**
 * Parse a MySQL connection URL
 * Format: mysql://user:password@host:port/database
 */
function parseDbUrl(url: string): Partial<DatabaseConfig> {
  try {
    // Handle mysql:// prefix by converting to a parseable URL
    const parsedUrl = new URL(url.replace(/^mysql:\/\//, 'http://'));

    return {
      host: parsedUrl.hostname || undefined,
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : undefined,
      user: parsedUrl.username || undefined,
      password: decodeURIComponent(parsedUrl.password || ''),
      database: parsedUrl.pathname?.slice(1) || undefined, // Remove leading /
    };
  } catch (error) {
    logger.error('Failed to parse DB_URL', { error: String(error) });
    return {};
  }
}

/**
 * Get database configuration from environment variables
 * Supports both individual env vars and DB_URL connection string
 */
function getConfig(): DatabaseConfig {
  // If DB_URL is provided, parse it and use those values
  const urlConfig = process.env.DB_URL ? parseDbUrl(process.env.DB_URL) : {};

  return {
    host: urlConfig.host || process.env.DB_HOST || 'rdss2.speedex.it',
    port: urlConfig.port || parseInt(process.env.DB_PORT || '3306', 10),
    user: urlConfig.user || process.env.DB_USER || 'i2',
    password: urlConfig.password || process.env.DB_PASSWORD || '',
    database: urlConfig.database || process.env.DB_NAME || 'i2_speedex',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  };
}

/**
 * Get or create the connection pool
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    const config = getConfig();

    logger.info('Creating database connection pool', {
      host: config.host,
      database: config.database,
      connectionLimit: config.connectionLimit,
    });

    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: config.connectionLimit,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      // Return dates as strings to avoid timezone issues
      dateStrings: true,
    });
  }

  return pool;
}

/**
 * Get a connection from the pool
 */
export async function getConnection(): Promise<mysql.PoolConnection> {
  const p = getPool();
  return p.getConnection();
}

/**
 * Execute a query using the pool
 * Uses query() instead of execute() to avoid prepared statement issues with LIMIT/OFFSET
 */
export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows as T[];
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<mysql.ResultSetHeader> {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

/**
 * Execute a function within a transaction
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>
): Promise<T> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const result = await callback(connection);

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Execute a query within a transaction connection
 */
export async function transactionQuery<T = unknown>(
  connection: mysql.PoolConnection,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const [rows] = await connection.execute(sql, params);
  return rows as T[];
}

/**
 * Execute a data modification query within a transaction connection
 */
export async function transactionExecute(
  connection: mysql.PoolConnection,
  sql: string,
  params?: unknown[]
): Promise<mysql.ResultSetHeader> {
  const [result] = await connection.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing database connection pool');
    await pool.end();
    pool = null;
  }
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query<{ result: number }>('SELECT 1 as result');
    return result.length === 1 && result[0].result === 1;
  } catch (error) {
    logger.error('Database connection test failed', { error: String(error) });
    return false;
  }
}
