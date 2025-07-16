import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

const operationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  operation: z.enum(['snooze', 'archive', 'star', 'unstar', 'read', 'unread', 'move']),
  payload: z.record(z.any()),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  retry_count: z.number(),
  created_at: z.string().transform(val => new Date(val)),
});

/**
 * POST /api/emails/operations - Process email operations from outbox
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const operation = operationSchema.parse(body);
    
    // Mark as processing
    await supabase
      .from('outbox')
      .update({ status: 'processing' })
      .eq('id', operation.id);
    
    try {
      await processOperation(operation);
      
      // Mark as completed
      await supabase
        .from('outbox')
        .update({ status: 'completed' })
        .eq('id', operation.id);
      
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Operation processing error:', error);
      
      // Mark as failed and increment retry count
      await supabase
        .from('outbox')
        .update({ 
          status: 'failed',
          retry_count: operation.retry_count + 1,
        })
        .eq('id', operation.id);
      
      return NextResponse.json(
        { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Operation request error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

async function processOperation(operation: any) {
  const { operation: op, payload } = operation;
  
  switch (op) {
    case 'snooze':
      await handleSnooze(payload);
      break;
    case 'archive':
      await handleArchive(payload);
      break;
    case 'star':
    case 'unstar':
      await handleStar(payload, op === 'star');
      break;
    case 'read':
    case 'unread':
      await handleRead(payload, op === 'read');
      break;
    case 'move':
      await handleMove(payload);
      break;
    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}

async function handleSnooze(payload: any) {
  const { email_id, snooze_until } = payload;
  
  // Add to Redis sorted set for time-based retrieval
  await redis.zadd('snoozed_emails', {
    score: new Date(snooze_until).getTime(),
    member: email_id,
  });
  
  // Update email metadata
  await supabase
    .from('emails')
    .update({
      labels: ['SNOOZED'],
      sync_state: { snoozed_until: snooze_until },
    })
    .eq('id', email_id);
}

async function handleArchive(payload: any) {
  const { email_id } = payload;
  
  // Remove from INBOX, add to ARCHIVE
  await supabase
    .from('emails')
    .update({
      labels: ['ARCHIVE'],
    })
    .eq('id', email_id);
}

async function handleStar(payload: any, starred: boolean) {
  const { email_id } = payload;
  
  await supabase
    .from('emails')
    .update({
      is_starred: starred,
    })
    .eq('id', email_id);
}

async function handleRead(payload: any, read: boolean) {
  const { email_id } = payload;
  
  await supabase
    .from('emails')
    .update({
      is_read: read,
    })
    .eq('id', email_id);
}

async function handleMove(payload: any) {
  const { email_id, folder } = payload;
  
  await supabase
    .from('emails')
    .update({
      labels: [folder.toUpperCase()],
    })
    .eq('id', email_id);
}