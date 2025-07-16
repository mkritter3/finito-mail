import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { Client as PgClient } from 'pg';
import { verify } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const dbClient = new PgClient({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/emails/sync - Trigger async email sync
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as any;
    const userId = decoded.sub;

    // Create sync job ID
    const jobId = uuidv4();
    
    await dbClient.connect();

    try {
      // Check if there's already a sync job running for this user
      const existingJob = await dbClient.query(
        'SELECT id FROM sync_jobs WHERE user_id = $1 AND status = $2',
        [userId, 'processing']
      );

      if (existingJob.rows.length > 0) {
        return NextResponse.json({ 
          message: 'Sync already in progress',
          jobId: existingJob.rows[0].id,
          status: 'processing'
        });
      }

      // Create sync job record
      await dbClient.query(
        `INSERT INTO sync_jobs (id, user_id, status, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [jobId, userId, 'pending']
      );

      // Schedule background job with QStash
      await qstashClient.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/emails/sync/process`,
        body: {
          jobId,
          userId,
          timestamp: new Date().toISOString()
        },
        headers: {
          'authorization': `Bearer ${process.env.QSTASH_TOKEN!}`
        }
      });

      return NextResponse.json({ 
        message: 'Email sync started',
        jobId,
        status: 'pending'
      });

    } finally {
      await dbClient.end();
    }

  } catch (error) {
    console.error('Sync initiation error:', error);
    return NextResponse.json({ error: 'Failed to start sync' }, { status: 500 });
  }
}

/**
 * GET /api/emails/sync - Get sync status
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as any;
    const userId = decoded.sub;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    await dbClient.connect();

    try {
      let query = 'SELECT * FROM sync_jobs WHERE user_id = $1';
      let params = [userId];

      if (jobId) {
        query += ' AND id = $2';
        params.push(jobId);
      }

      query += ' ORDER BY created_at DESC LIMIT 1';

      const result = await dbClient.query(query, params);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'No sync jobs found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);

    } finally {
      await dbClient.end();
    }

  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}