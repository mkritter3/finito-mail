import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { EmailSyncService } from '../../../../lib/email-sync';
import { RulesEngineService } from '../../../../lib/rules-engine/service';
import { PatternAnalysisWorker } from '../../../../lib/onboarding/pattern-analysis-worker';
import { GmailClientEnhanced } from '@finito/provider-client';
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
      
      // If sync was successful, process rules for newly synced emails AND trigger pattern analysis
      let rulesProcessed = 0;
      let rulesErrors = 0;
      let patternAnalysisTriggered = false;
      
      if (result.success && result.count > 0) {
        // Check if this is the first sync for this user (trigger pattern analysis)
        const syncHistoryResult = await dbClient.query(
          'SELECT COUNT(*) as count FROM sync_jobs WHERE user_id = $1 AND status = $2',
          [userId, 'completed']
        );
        
        const isFirstSync = parseInt(syncHistoryResult.rows[0].count) === 0;
        
        if (isFirstSync) {
          // Trigger pattern analysis for onboarding suggestions
          try {
            console.log(`🔍 Triggering pattern analysis for first-time user ${userId}`);
            const analysisResult = await PatternAnalysisWorker.processUser(userId);
            
            if (analysisResult.success) {
              console.log(`✅ Pattern analysis completed: ${analysisResult.suggestionsCreated} suggestions created`);
              patternAnalysisTriggered = true;
            } else {
              console.error(`❌ Pattern analysis failed: ${analysisResult.error}`);
            }
          } catch (analysisError) {
            console.error('Pattern analysis error:', analysisError);
          }
        }
        try {
          // Get Gmail client for rules processing
          const gmailClient = new GmailClientEnhanced();
          const rulesService = new RulesEngineService(gmailClient);
          
          // Get user's Google tokens
          const tokenResult = await dbClient.query(
            'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
            [userId]
          );

          if (tokenResult.rows.length > 0) {
            const tokens = tokenResult.rows[0];
            const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000);

            // Get Gmail client with token refresh
            const gmail_client = await gmailClient.getGmailClientWithRefresh({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt,
              emailAccountId: userId,
            });

            // Get recently synced emails from database
            const emailsResult = await dbClient.query(
              `SELECT gmail_message_id, subject, snippet, from_address, to_addresses, received_at, is_read, raw_gmail_metadata 
               FROM email_metadata 
               WHERE user_id = $1 
               ORDER BY received_at DESC 
               LIMIT $2`,
              [userId, result.count]
            );

            console.log(`Processing ${emailsResult.rows.length} emails through rules engine`);

            // Process each email through the rules engine
            for (const emailRow of emailsResult.rows) {
              try {
                const emailContext = {
                  gmail_message_id: emailRow.gmail_message_id,
                  subject: emailRow.subject || '',
                  snippet: emailRow.snippet || '',
                  from_address: emailRow.from_address,
                  to_addresses: emailRow.to_addresses,
                  received_at: emailRow.received_at,
                  is_read: emailRow.is_read,
                  raw_gmail_metadata: emailRow.raw_gmail_metadata
                };

                const rulesResult = await rulesService.processEmail(userId, emailContext, gmail_client);
                rulesProcessed++;
                
                console.log(`✅ Processed email ${emailRow.gmail_message_id}: ${rulesResult.rulesExecuted} rules, ${rulesResult.actionsExecuted} actions`);
              } catch (ruleError) {
                console.error(`❌ Error processing email ${emailRow.gmail_message_id} through rules:`, ruleError);
                rulesErrors++;
              }
            }
          }
        } catch (rulesError) {
          console.error('Rules processing error:', rulesError);
          rulesErrors++;
        }
      }

      if (result.success) {
        // Update job status to completed
        await dbClient.query(
          `UPDATE sync_jobs SET 
           status = $1, 
           completed_at = NOW(),
           emails_synced = $2,
           timing_data = $3,
           rules_processed = $4,
           rules_errors = $5
           WHERE id = $6`,
          ['completed', result.count, JSON.stringify(result.timing), rulesProcessed, rulesErrors, jobId]
        );

        console.log(`✅ Sync job ${jobId} completed successfully: ${result.count} emails, ${rulesProcessed} rules processed, ${rulesErrors} rules errors, pattern analysis: ${patternAnalysisTriggered}`);
        
        return NextResponse.json({ 
          success: true, 
          jobId,
          emailsSynced: result.count,
          timing: result.timing,
          rulesProcessed,
          rulesErrors,
          patternAnalysisTriggered,
          onboardingSuggestions: patternAnalysisTriggered ? 'Pattern analysis completed - check /api/onboarding/suggestions' : 'Not applicable'
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