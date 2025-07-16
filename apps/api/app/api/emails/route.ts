import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const emailQuerySchema = z.object({
  folder: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  is_read: z.string().transform(val => val === 'true').optional(),
  is_starred: z.string().transform(val => val === 'true').optional(),
  from: z.string().optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
});

/**
 * GET /api/emails - Get email metadata
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = emailQuerySchema.parse(Object.fromEntries(searchParams));
    
    // TODO: Get user_id from auth context
    const userId = 'current-user';
    
    let dbQuery = supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);
    
    // Apply filters
    if (query.folder) {
      dbQuery = dbQuery.contains('labels', [query.folder.toUpperCase()]);
    }
    
    if (query.is_read !== undefined) {
      dbQuery = dbQuery.eq('is_read', query.is_read);
    }
    
    if (query.is_starred !== undefined) {
      dbQuery = dbQuery.eq('is_starred', query.is_starred);
    }
    
    if (query.from) {
      dbQuery = dbQuery.or(`from_email.ilike.%${query.from}%,from_name.ilike.%${query.from}%`);
    }
    
    if (query.date_start) {
      dbQuery = dbQuery.gte('date', query.date_start);
    }
    
    if (query.date_end) {
      dbQuery = dbQuery.lte('date', query.date_end);
    }
    
    const { data: emails, error } = await dbQuery;
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Email fetch error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

const emailBatchSchema = z.object({
  emails: z.array(z.object({
    id: z.string(),
    user_id: z.string(),
    thread_id: z.string(),
    subject: z.string(),
    from_email: z.string(),
    from_name: z.string().optional(),
    date: z.string().transform(val => new Date(val)),
    labels: z.array(z.string()),
    is_read: z.boolean(),
    is_starred: z.boolean(),
    snippet: z.string(),
    sync_state: z.record(z.any()),
    created_at: z.string().transform(val => new Date(val)),
  })),
});

/**
 * POST /api/emails - Store email metadata in bulk
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emails } = emailBatchSchema.parse(body);
    
    // Insert emails into PostgreSQL
    const { error } = await supabase
      .from('emails')
      .upsert(emails, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, count: emails.length });
  } catch (error) {
    console.error('Email store error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}