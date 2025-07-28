#!/usr/bin/env tsx
/**
 * Check table structure in local database
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkTableStructure() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get one row to see the structure
  const { data, error } = await supabase
    .from('email_metadata')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('email_metadata columns:', Object.keys(data[0]))
  } else {
    console.log('No data in email_metadata table, attempting insert to see structure...')
    
    // Try a minimal insert to see what columns exist
    const { error: insertError } = await supabase
      .from('email_metadata')
      .insert({
        user_id: 'f10f54b3-b17e-4c13-bde6-894576d2bf60', // Alice's ID
        gmail_message_id: 'test-structure-check',
        gmail_thread_id: 'test-thread',
        subject: 'Test',
        from_email: 'test@example.com',
        to_emails: ['alice@demo.local'],
        received_at: new Date().toISOString()
      })

    if (insertError) {
      console.log('Insert error details:', insertError)
      // Error message often reveals required columns
    }
  }
}

checkTableStructure()