'use server'

import { z } from 'zod'
import { emailSync } from '@finito/provider-client'
import { ServerActionResult, SyncResult } from '@/lib/types'
import { createScopedLogger } from '@/lib/logger'

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
  logger.info({ action: 'syncRecentEmails', count }, 'Starting email sync')

  // Validate input
  const validation = SyncEmailsSchema.safeParse({ count })
  if (!validation.success) {
    logger.warn({ 
      action: 'syncRecentEmails', 
      errors: validation.error.flatten().fieldErrors 
    }, 'Validation failed')
    return { 
      data: null, 
      error: 'Invalid input parameters',
      details: validation.error.flatten().fieldErrors
    }
  }

  const { count: validatedCount } = validation.data

  try {
    await emailSync.syncRecentEmails(validatedCount)
    logger.info({ action: 'syncRecentEmails', count: validatedCount }, 'Email sync completed successfully')
    return { 
      data: { 
        success: true, 
        emailsSynced: validatedCount, 
        errors: [] 
      }, 
      error: null 
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ 
      action: 'syncRecentEmails', 
      count: validatedCount, 
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined } 
    }, 'Email sync failed')
    return { 
      data: null, 
      error: 'Failed to sync emails. Please try again.',
      details: { originalError: errorMessage }
    }
  }
}

/**
 * Server Action to check if user is authenticated
 * This runs on the server side and can safely access authentication services
 */
export async function checkAuthentication(): Promise<ServerActionResult<{ authenticated: boolean }>> {
  logger.info({ action: 'checkAuthentication' }, 'Checking user authentication')

  try {
    const isAuthenticated = await emailSync.isAuthenticated()
    logger.info({ action: 'checkAuthentication', authenticated: isAuthenticated }, 'Authentication check completed')
    return { 
      data: { authenticated: isAuthenticated }, 
      error: null 
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ 
      action: 'checkAuthentication', 
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined } 
    }, 'Authentication check failed')
    return { 
      data: null, 
      error: 'Failed to check authentication status',
      details: { originalError: errorMessage }
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
export async function syncFolder(folder: string = 'INBOX', maxResults: number = 50): Promise<ServerActionResult<SyncResult>> {
  logger.info({ action: 'syncFolder', folder, maxResults }, 'Starting folder sync')

  // Validate input
  const validation = SyncFolderSchema.safeParse({ folder, maxResults })
  if (!validation.success) {
    logger.warn({ 
      action: 'syncFolder', 
      errors: validation.error.flatten().fieldErrors 
    }, 'Validation failed')
    return { 
      data: null, 
      error: 'Invalid input parameters',
      details: validation.error.flatten().fieldErrors
    }
  }

  const { folder: validatedFolder, maxResults: validatedMaxResults } = validation.data

  try {
    await emailSync.syncFolder(validatedFolder, validatedMaxResults)
    logger.info({ action: 'syncFolder', folder: validatedFolder, maxResults: validatedMaxResults }, 'Folder sync completed successfully')
    return { 
      data: { 
        success: true, 
        emailsSynced: validatedMaxResults, 
        errors: [] 
      }, 
      error: null 
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ 
      action: 'syncFolder', 
      folder: validatedFolder, 
      maxResults: validatedMaxResults, 
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined } 
    }, 'Folder sync failed')
    return { 
      data: null, 
      error: 'Failed to sync folder. Please try again.',
      details: { originalError: errorMessage }
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
  logger.info({ action: 'sendEmail', to: emailData.to, subject: emailData.subject }, 'Starting email send')

  // Validate input
  const validation = SendEmailSchema.safeParse(emailData)
  if (!validation.success) {
    logger.warn({ 
      action: 'sendEmail', 
      errors: validation.error.flatten().fieldErrors 
    }, 'Email validation failed')
    return { 
      data: null, 
      error: 'Invalid email data',
      details: validation.error.flatten().fieldErrors
    }
  }

  const validatedData = validation.data

  try {
    // Import Gmail client dynamically on server-side
    const { gmailClient } = await import('@finito/provider-client')
    
    // Build email message
    const messageParts = [
      `To: ${validatedData.to}`,
      validatedData.cc ? `Cc: ${validatedData.cc}` : '',
      validatedData.bcc ? `Bcc: ${validatedData.bcc}` : '',
      `Subject: ${validatedData.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      validatedData.body
    ].filter(Boolean).join('\n')

    const encodedMessage = btoa(messageParts)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send email using Gmail client
    const result = await gmailClient.sendEmail({
      raw: encodedMessage,
      threadId: validatedData.threadId
    })

    logger.info({ 
      action: 'sendEmail', 
      to: validatedData.to, 
      subject: validatedData.subject, 
      messageId: result.id,
      threadId: result.threadId
    }, 'Email sent successfully')

    return { 
      data: { 
        success: true, 
        messageId: result.id,
        threadId: result.threadId
      }, 
      error: null 
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ 
      action: 'sendEmail', 
      to: validatedData.to, 
      subject: validatedData.subject, 
      error: { message: errorMessage, stack: error instanceof Error ? error.stack : undefined } 
    }, 'Email send failed')
    return { 
      data: null, 
      error: 'Failed to send email. Please try again.',
      details: { originalError: errorMessage }
    }
  }
}