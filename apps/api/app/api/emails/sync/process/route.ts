import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { EmailSyncService } from '@/lib/email-sync';
import { z } from 'zod';

const syncJobSchema = z.object({
  jobId: z.string(),
  userId: z.string(),
  timestamp: z.string(),
});

const dbClient = new Client({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/emails/sync/process - Process async email sync job
 * This endpoint is called by QStash for background processing
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate QStash request
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== process.env.QSTASH_TOKEN!) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, userId, timestamp } = syncJobSchema.parse(body);

    await dbClient.connect();

    try {
      // Update job status to processing
      await dbClient.query(
        'UPDATE sync_jobs SET status = $1, started_at = NOW() WHERE id = $2',
        ['processing', jobId]
      );

      // Create email sync service
      const emailSync = new EmailSyncService();
      
      // Perform the sync
      const result = await emailSync.syncRecentEmails(userId);

      if (result.success) {
        // Update job status to completed
        await dbClient.query(
          `UPDATE sync_jobs SET 
           status = $1, 
           completed_at = NOW(),
           emails_synced = $2,
           timing_data = $3
           WHERE id = $4`,
          ['completed', result.count, JSON.stringify(result.timing), jobId]
        );

        console.log(`✅ Sync job ${jobId} completed successfully: ${result.count} emails`);
        
        return NextResponse.json({ 
          success: true, 
          jobId,
          emailsSynced: result.count,
          timing: result.timing 
        });
      } else {
        // Update job status to failed
        await dbClient.query(
          `UPDATE sync_jobs SET 
           status = $1, 
           completed_at = NOW(),
           error_message = $2
           WHERE id = $3`,
          ['failed', result.error, jobId]
        );

        console.error(`❌ Sync job ${jobId} failed: ${result.error}`);
        
        return NextResponse.json({ 
          success: false, 
          jobId,
          error: result.error 
        }, { status: 500 });
      }

    } finally {
      await dbClient.end();
    }

  } catch (error) {
    console.error('Sync processing error:', error);
    
    // Try to mark job as failed
    try {
      await dbClient.connect();
      await dbClient.query(
        `UPDATE sync_jobs SET 
         status = $1, 
         completed_at = NOW(),
         error_message = $2
         WHERE id = $3`,
        ['failed', error instanceof Error ? error.message : 'Unknown error', request.url]
      );
      await dbClient.end();
    } catch (dbError) {
      console.error('Failed to update job status:', dbError);
    }

    return NextResponse.json({ error: 'Sync processing failed' }, { status: 500 });
  }
}