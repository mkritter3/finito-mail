import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@upstash/qstash';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const syncRequestSchema = z.object({
  client_id: z.string(),
  max_emails: z.number().min(1).max(100).default(50),
  sync_type: z.enum(['full', 'incremental']).optional(),
});

/**
 * POST /api/sync/request - Request a sync job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, max_emails, sync_type = 'incremental' } = syncRequestSchema.parse(body);
    
    // TODO: Get user_id from auth context
    const userId = 'current-user';
    
    // Check if there's existing sync metadata
    const { data: syncMetadata } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // Determine sync type based on existing data
    const finalSyncType = syncMetadata?.last_sync_time ? 'incremental' : 'full';
    
    // Create sync job
    const syncJob = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: finalSyncType === 'full' ? 'gmail_full_sync' : 'gmail_incremental_sync',
      account_id: userId,
      credentials: {
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        access_token: 'TODO_GET_FROM_USER_SESSION',
        refresh_token: 'TODO_GET_FROM_USER_SESSION', 
        expires_at: Date.now() + 3600000, // 1 hour
      },
      parameters: {
        max_emails,
        page_token: finalSyncType === 'full' ? syncMetadata?.next_page_token : undefined,
        start_history_id: finalSyncType === 'incremental' ? syncMetadata?.last_history_id : undefined,
      },
      created_at: new Date().toISOString(),
      priority: 'medium' as const,
    };
    
    // Store job in database
    await supabase
      .from('sync_jobs')
      .insert({
        id: syncJob.id,
        user_id: userId,
        type: syncJob.type,
        status: 'pending',
        parameters: syncJob.parameters,
        created_at: syncJob.created_at,
      });
    
    // Schedule job processing with QStash
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/sync/process`,
      body: syncJob,
      delay: 1, // Process immediately
    });
    
    return NextResponse.json(syncJob);
  } catch (error) {
    console.error('Sync request error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}