import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { EmailSyncService } from '@/lib/email-sync';
import { dbPool } from '@/lib/db-pool';
import { emailCache } from '@/lib/email-cache';

const emailQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  is_read: z.string().transform(val => val === 'true').optional(),
  from: z.string().optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
});

/**
 * GET /api/emails - Get email metadata for authenticated user
 */
export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = emailQuerySchema.parse(Object.fromEntries(searchParams));
    
    const userId = request.user.id;
    
    // Check cache first
    const cachedEmails = await emailCache.getCachedEmailList(userId, query);
    if (cachedEmails) {
      return NextResponse.json({ emails: cachedEmails, cached: true });
    }
    
    try {
      // Base query
      let sqlQuery = `
        SELECT
          id,
          gmail_message_id,
          gmail_thread_id,
          subject,
          snippet,
          from_address,
          to_addresses,
          received_at,
          is_read
        FROM email_metadata
        WHERE user_id = $1
      `;
      
      const params: any[] = [userId];
      let paramIndex = 2;
      
      // Apply filters
      if (query.is_read !== undefined) {
        sqlQuery += ` AND is_read = $${paramIndex}`;
        params.push(query.is_read);
        paramIndex++;
      }
      
      if (query.from) {
        sqlQuery += ` AND from_address->>'email' ILIKE $${paramIndex}`;
        params.push(`%${query.from}%`);
        paramIndex++;
      }
      
      if (query.date_start) {
        sqlQuery += ` AND received_at >= $${paramIndex}`;
        params.push(query.date_start);
        paramIndex++;
      }
      
      if (query.date_end) {
        sqlQuery += ` AND received_at <= $${paramIndex}`;
        params.push(query.date_end);
        paramIndex++;
      }
      
      // Add ordering and pagination
      sqlQuery += ` ORDER BY received_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(query.limit, query.offset);
      
      const result = await dbPool.query(sqlQuery, params);
      
      // Cache the results
      await emailCache.cacheEmailList(userId, query, result.rows);
      
      return NextResponse.json({ emails: result.rows, cached: false });
    } catch (error) {
      throw error; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error('Email fetch error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

/**
 * POST /api/emails - Trigger async email sync for authenticated user
 */
export const POST = withAuth(async (request) => {
  try {
    const userId = request.user.id;
    
    // Check sync preference from query params
    const { searchParams } = new URL(request.url);
    const syncMode = searchParams.get('mode') || 'async';
    
    if (syncMode === 'sync') {
      // Fallback to synchronous sync for immediate results
      const emailSync = new EmailSyncService();
      const result = await emailSync.syncRecentEmails(userId);
      
      if (result.success) {
        return NextResponse.json({ 
          success: true, 
          message: `Synced ${result.count} emails`,
          count: result.count,
          mode: 'sync'
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: result.error 
        }, { status: 500 });
      }
    } else {
      // Forward to async sync endpoint
      const token = request.headers.get('Authorization');
      const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/emails/sync`, {
        method: 'POST',
        headers: {
          'Authorization': token!,
          'Content-Type': 'application/json'
        }
      });
      
      const syncData = await syncResponse.json();
      
      if (syncResponse.ok) {
        return NextResponse.json({
          success: true,
          message: 'Email sync started in background',
          jobId: syncData.jobId,
          status: syncData.status,
          mode: 'async'
        });
      } else {
        return NextResponse.json(syncData, { status: syncResponse.status });
      }
    }
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
});