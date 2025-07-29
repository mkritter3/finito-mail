'use server'

import { z } from 'zod'
import { gmailService } from '@/lib/services/gmail-service.server'
import { ServerActionResult, SyncResult } from '@/lib/types'
import { createScopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'

const logger = createScopedLogger('email-sync')

// Validation schemas
const SyncEmailsSchema = z.object({
  count: z.number().min(1).max(100).default(5),
})

/**
 * Server Action to sync recent emails from Gmail
 * This runs on the server side and can safely import Gmail API libraries
 */
export async function syncRecentEmails(count: number = 5): Promise<ServerActionResult<SyncResult>> {
  logger.info('Starting email sync', { action: 'syncRecentEmails', count })

  // Validate input
  const validation = SyncEmailsSchema.safeParse({ count })
  if (!validation.success) {
    logger.warn('Validation failed', {
      action: 'syncRecentEmails',
      errors: validation.error.flatten().fieldErrors,
    })
    return {
      data: null,
      error: 'Invalid input parameters',
      details: validation.error.flatten().fieldErrors,
    }
  }

  const { count: validatedCount } = validation.data

  try {
    // Fetch emails from Gmail using server-safe service
    const emails = await gmailService.syncRecentEmails(validatedCount)
    
    // Store emails in Supabase
    const supabase = createAdminClient()
    let storedCount = 0
    
    for (const email of emails) {
      try {
        await supabase.from('email_metadata').upsert({
          id: email.id,
          thread_id: email.threadId,
          from_email: email.from,
          to_email: email.to,
          subject: email.subject,
          body_snippet: email.body.substring(0, 200),
          sent_at: email.date,
          is_read: email.isRead,
          is_starred: email.isStarred,
          folder: email.folder,
          labels: email.labels,
          provider: email.provider,
        })
        storedCount++
      } catch (err) {
        logger.error('Failed to store email', { emailId: email.id, error: err })
      }
    }
    
    logger.info('Email sync completed successfully', {
      action: 'syncRecentEmails',
      fetched: emails.length,
      stored: storedCount,
    })
    
    return {
      data: {
        success: true,
        emailsSynced: storedCount,
        errors: [],
      },
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Email sync failed', {
      action: 'syncRecentEmails',
      count: validatedCount,
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    })
    return {
      data: null,
      error: 'Failed to sync emails. Please try again.',
      details: { originalError: errorMessage },
    }
  }
}

/**
 * Server Action to check if user is authenticated
 * This runs on the server side and can safely access authentication services
 */
export async function checkAuthentication(): Promise<
  ServerActionResult<{ authenticated: boolean }>
> {
  logger.info('Checking user authentication', { action: 'checkAuthentication' })

  try {
    // Check if user has Google tokens stored
    const { getGoogleAccessToken } = await import('@/lib/server/google-auth')
    const token = await getGoogleAccessToken()
    const isAuthenticated = token !== null
    
    logger.info('Authentication check completed', {
      action: 'checkAuthentication',
      authenticated: isAuthenticated,
    })
    return {
      data: { authenticated: isAuthenticated },
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Authentication check failed', {
      action: 'checkAuthentication',
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    })
    return {
      data: null,
      error: 'Failed to check authentication status',
      details: { originalError: errorMessage },
    }
  }
}

// Folder sync validation schema
const SyncFolderSchema = z.object({
  folder: z.string().min(1).default('INBOX'),
  maxResults: z.number().min(1).max(200).default(50),
})

/**
 * Server Action to sync specific folder
 * This runs on the server side and can safely import Gmail API libraries
 */
export async function syncFolder(
  folder: string = 'INBOX',
  maxResults: number = 50
): Promise<ServerActionResult<SyncResult>> {
  logger.info('Starting folder sync', { action: 'syncFolder', folder, maxResults })

  // Validate input
  const validation = SyncFolderSchema.safeParse({ folder, maxResults })
  if (!validation.success) {
    logger.warn('Validation failed', {
      action: 'syncFolder',
      errors: validation.error.flatten().fieldErrors,
    })
    return {
      data: null,
      error: 'Invalid input parameters',
      details: validation.error.flatten().fieldErrors,
    }
  }

  const { folder: validatedFolder, maxResults: validatedMaxResults } = validation.data

  try {
    // Fetch emails from Gmail folder using server-safe service
    const emails = await gmailService.syncFolder(validatedFolder, validatedMaxResults)
    
    // Store emails in Supabase
    const supabase = createAdminClient()
    let storedCount = 0
    
    for (const email of emails) {
      try {
        await supabase.from('email_metadata').upsert({
          id: email.id,
          thread_id: email.threadId,
          from_email: email.from,
          to_email: email.to,
          subject: email.subject,
          body_snippet: email.body.substring(0, 200),
          sent_at: email.date,
          is_read: email.isRead,
          is_starred: email.isStarred,
          folder: email.folder,
          labels: email.labels,
          provider: email.provider,
        })
        storedCount++
      } catch (err) {
        logger.error('Failed to store email', { emailId: email.id, error: err })
      }
    }
    
    logger.info('Folder sync completed successfully', {
      action: 'syncFolder',
      folder: validatedFolder,
      fetched: emails.length,
      stored: storedCount,
    })
    
    return {
      data: {
        success: true,
        emailsSynced: storedCount,
        errors: [],
      },
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Folder sync failed', {
      action: 'syncFolder',
      folder: validatedFolder,
      maxResults: validatedMaxResults,
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    })
    return {
      data: null,
      error: 'Failed to sync folder. Please try again.',
      details: { originalError: errorMessage },
    }
  }
}

// Email send validation schema
const SendEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  cc: z.string().email('Invalid CC email address').optional(),
  bcc: z.string().email('Invalid BCC email address').optional(),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject too long'),
  body: z.string().min(1, 'Email body is required').max(10000, 'Email body too long'),
  threadId: z.string().optional(),
})

interface SendEmailResult {
  success: boolean
  messageId?: string
  threadId?: string
}

/**
 * Server Action to send email
 * This runs on the server side and can safely import Gmail API libraries
 */
export async function sendEmail(emailData: {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  threadId?: string
}): Promise<ServerActionResult<SendEmailResult>> {
  logger.info('Starting email send', {
    action: 'sendEmail',
    to: emailData.to,
    subject: emailData.subject,
  })

  // Validate input
  const validation = SendEmailSchema.safeParse(emailData)
  if (!validation.success) {
    logger.warn('Email validation failed', {
      action: 'sendEmail',
      errors: validation.error.flatten().fieldErrors,
    })
    return {
      data: null,
      error: 'Invalid email data',
      details: validation.error.flatten().fieldErrors,
    }
  }

  const validatedData = validation.data

  try {
    // Send email using server-safe Gmail service
    const result = await gmailService.sendEmail({
      to: validatedData.to,
      cc: validatedData.cc,
      bcc: validatedData.bcc,
      subject: validatedData.subject,
      body: validatedData.body,
      threadId: validatedData.threadId,
    })

    logger.info('Email sent successfully', {
      action: 'sendEmail',
      to: validatedData.to,
      subject: validatedData.subject,
      messageId: result.id,
      threadId: result.threadId,
    })

    return {
      data: {
        success: true,
        messageId: result.id,
        threadId: result.threadId,
      },
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Email send failed', {
      action: 'sendEmail',
      to: validatedData.to,
      subject: validatedData.subject,
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    })
    return {
      data: null,
      error: 'Failed to send email. Please try again.',
      details: { originalError: errorMessage },
    }
  }
}
