import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/emails/[id] - Get single email metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Get user_id from auth context
    const userId = 'current-user';
    
    const { data: email, error } = await supabase
      .from('emails')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    return NextResponse.json(email);
  } catch (error) {
    console.error('Email fetch error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}