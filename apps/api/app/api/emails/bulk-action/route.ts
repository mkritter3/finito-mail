import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { GmailClientEnhanced } from '@finito/provider-client';
import { dbPool } from '@/lib/db-pool';
import { emailCache } from '@/lib/email-cache';
import { GmailBatchService, BatchAction } from '@/lib/gmail-batch-service';

const gmailClient = new GmailClientEnhanced({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
});

const bulkActionSchema = z.object({
  emailIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['mark_read', 'mark_unread', 'archive', 'delete', 'add_label', 'remove_label']),
  labelId: z.string().optional(),
});

/**
 * POST /api/emails/bulk-action - Perform bulk actions on emails
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { emailIds, action, labelId } = bulkActionSchema.parse(body);
    
    const userId = request.user.id;
    
    // Get user's Google tokens
    const tokenResult = await dbPool.query(
      'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ error: 'No Google tokens found' }, { status: 401 });
    }

    const tokens = tokenResult.rows[0];
    const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000);

    // Get Gmail client with token refresh
    const client = await gmailClient.getGmailClientWithRefresh({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      emailAccountId: userId,
    });

    // Create batch actions
    const batchActions: BatchAction[] = emailIds.map(emailId => ({
      emailId,
      action,
      labelId
    }));

    // Validate batch actions
    const validation = GmailBatchService.validateBatchActions(batchActions);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid batch actions',
        details: validation.errors
      }, { status: 400 });
    }

    // Execute batch actions using the batch service
    const batchService = new GmailBatchService(gmailClient);
    const results = await batchService.executeBatchActions(client, batchActions);

    // Separate successful and failed results
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    // Update database records for successful actions
    if (successfulResults.length > 0) {
      try {
        const successfulEmailIds = successfulResults.map(r => r.emailId);
        
        // Update database based on action
        switch (action) {
          case 'mark_read':
            await dbPool.query(
              `UPDATE email_metadata 
               SET is_read = true, updated_at = NOW() 
               WHERE user_id = $1 AND gmail_message_id = ANY($2)`,
              [userId, successfulEmailIds]
            );
            break;
          case 'mark_unread':
            await dbPool.query(
              `UPDATE email_metadata 
               SET is_read = false, updated_at = NOW() 
               WHERE user_id = $1 AND gmail_message_id = ANY($2)`,
              [userId, successfulEmailIds]
            );
            break;
          case 'delete':
            await dbPool.query(
              `DELETE FROM email_metadata 
               WHERE user_id = $1 AND gmail_message_id = ANY($2)`,
              [userId, successfulEmailIds]
            );
            break;
          // For archive and label actions, we'll update on next sync
        }
      } catch (dbError) {
        console.error('Database update error:', dbError);
        // Don't fail the request for database errors
      }
    }

    // Invalidate relevant caches
    await emailCache.invalidateEmailListCache(userId);
    
    // Invalidate individual email caches for processed emails
    for (const emailId of emailIds) {
      await emailCache.invalidateEmailDetailsCache(emailId);
    }

    return NextResponse.json({
      success: true,
      processed: emailIds.length,
      successful: successfulResults.length,
      failed: failedResults.length,
      results: successfulResults,
      errors: failedResults.length > 0 ? failedResults : undefined,
      optimisticUpdates: GmailBatchService.createOptimisticUpdates(batchActions)
    });

  } catch (error) {
    console.error('Bulk action error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Bulk action failed' 
    }, { status: 500 });
  }
});