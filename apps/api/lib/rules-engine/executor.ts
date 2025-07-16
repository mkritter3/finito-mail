import { GmailClientEnhanced } from '@finito/provider-client'
import { gmail_v1 } from 'googleapis'
import { RuleAction, RuleExecutionResult, RuleEvaluationContext, EmailContext } from './types'

export class RuleExecutor {
  private gmailClient: GmailClientEnhanced

  constructor(gmailClient: GmailClientEnhanced) {
    this.gmailClient = gmailClient
  }

  /**
   * Execute a list of actions on an email
   */
  async executeActions(
    actions: RuleAction[],
    context: RuleEvaluationContext
  ): Promise<RuleExecutionResult> {
    const startTime = Date.now()
    const actionsExecuted: RuleAction[] = []
    let stopProcessing = false

    try {
      for (const action of actions) {
        // Check if we should stop processing
        if (stopProcessing) {
          break
        }

        try {
          await this.executeAction(action, context)
          actionsExecuted.push(action)

          // Stop processing if action type is stop_processing
          if (action.type === 'stop_processing') {
            stopProcessing = true
          }
        } catch (error) {
          console.error(`Failed to execute action ${action.type}:`, error)
          // Continue with other actions even if one fails
        }
      }

      const executionTimeMs = Date.now() - startTime

      return {
        success: true,
        actionsExecuted,
        executionTimeMs,
        stopProcessing
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime
      return {
        success: false,
        actionsExecuted,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs
      }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: RuleAction, context: RuleEvaluationContext): Promise<void> {
    const { email, gmail_client } = context
    const messageId = email.gmail_message_id

    if (!gmail_client) {
      throw new Error('Gmail client not available')
    }

    switch (action.type) {
      case 'archive':
        await this.gmailClient.modifyMessage(gmail_client, messageId, [], ['INBOX'])
        break

      case 'delete':
        await this.gmailClient.deleteMessage(gmail_client, messageId)
        break

      case 'mark_read':
        await this.gmailClient.modifyMessage(gmail_client, messageId, [], ['UNREAD'])
        break

      case 'mark_unread':
        await this.gmailClient.modifyMessage(gmail_client, messageId, ['UNREAD'], [])
        break

      case 'add_label':
        if (!action.labelId) {
          throw new Error('Label ID required for add_label action')
        }
        await this.gmailClient.modifyMessage(gmail_client, messageId, [action.labelId], [])
        break

      case 'remove_label':
        if (!action.labelId) {
          throw new Error('Label ID required for remove_label action')
        }
        await this.gmailClient.modifyMessage(gmail_client, messageId, [], [action.labelId])
        break

      case 'forward':
        if (!action.forwardTo) {
          throw new Error('Forward email address required for forward action')
        }
        await this.forwardEmail(gmail_client, email, action.forwardTo)
        break

      case 'reply':
        if (!action.replyTemplate) {
          throw new Error('Reply template required for reply action')
        }
        await this.replyToEmail(gmail_client, email, action.replyTemplate)
        break

      case 'stop_processing':
        // This is handled in executeActions
        break

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Forward an email to another address
   */
  private async forwardEmail(
    gmail_client: gmail_v1.Gmail,
    email: EmailContext,
    forwardTo: string
  ): Promise<void> {
    // Get the full email content
    const fullMessage = await this.gmailClient.getMessage(gmail_client, email.gmail_message_id, 'full')
    
    // Create forward message
    const forwardSubject = `Fwd: ${email.subject || '(No Subject)'}`
    const forwardBody = `
---------- Forwarded message ---------
From: ${email.from_address?.email || 'Unknown'}
Date: ${email.received_at}
Subject: ${email.subject || '(No Subject)'}
To: ${email.to_addresses?.map(addr => addr.email).join(', ') || 'Unknown'}

${email.snippet}
    `.trim()

    const message = {
      raw: Buffer.from(
        `To: ${forwardTo}\r\n` +
        `Subject: ${forwardSubject}\r\n` +
        `\r\n` +
        `${forwardBody}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    await gmail_client.users.messages.send({
      userId: 'me',
      requestBody: message
    })
  }

  /**
   * Reply to an email with a template
   */
  private async replyToEmail(
    gmail_client: gmail_v1.Gmail,
    email: EmailContext,
    replyTemplate: string
  ): Promise<void> {
    // Get the full email content for In-Reply-To header
    const fullMessage = await this.gmailClient.getMessage(gmail_client, email.gmail_message_id, 'full')
    
    const replySubject = email.subject?.startsWith('Re:') 
      ? email.subject 
      : `Re: ${email.subject || '(No Subject)'}`
    
    const replyTo = email.from_address?.email
    if (!replyTo) {
      throw new Error('Cannot reply: sender email not found')
    }

    // Process template variables
    const processedTemplate = this.processReplyTemplate(replyTemplate, email)

    const message = {
      raw: Buffer.from(
        `To: ${replyTo}\r\n` +
        `Subject: ${replySubject}\r\n` +
        `In-Reply-To: ${email.gmail_message_id}\r\n` +
        `References: ${email.gmail_message_id}\r\n` +
        `\r\n` +
        `${processedTemplate}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    await gmail_client.users.messages.send({
      userId: 'me',
      requestBody: message
    })
  }

  /**
   * Process reply template variables
   */
  private processReplyTemplate(template: string, email: EmailContext): string {
    const variables = {
      '{{sender_name}}': email.from_address?.name || 'there',
      '{{sender_email}}': email.from_address?.email || '',
      '{{subject}}': email.subject || '',
      '{{date}}': email.received_at.toDateString(),
      '{{snippet}}': email.snippet || ''
    }

    let processed = template
    for (const [variable, value] of Object.entries(variables)) {
      processed = processed.replace(new RegExp(variable, 'g'), value)
    }

    return processed
  }

  /**
   * Test action execution (dry run)
   */
  static testAction(action: RuleAction, email: EmailContext): { canExecute: boolean; reason: string } {
    switch (action.type) {
      case 'archive':
        return { canExecute: true, reason: 'Will archive the email' }

      case 'delete':
        return { canExecute: true, reason: 'Will delete the email' }

      case 'mark_read':
        return { 
          canExecute: !email.is_read, 
          reason: email.is_read ? 'Email is already read' : 'Will mark as read'
        }

      case 'mark_unread':
        return { 
          canExecute: email.is_read, 
          reason: email.is_read ? 'Will mark as unread' : 'Email is already unread'
        }

      case 'add_label':
        if (!action.labelId) {
          return { canExecute: false, reason: 'Label ID is required' }
        }
        return { canExecute: true, reason: `Will add label ${action.labelId}` }

      case 'remove_label':
        if (!action.labelId) {
          return { canExecute: false, reason: 'Label ID is required' }
        }
        return { canExecute: true, reason: `Will remove label ${action.labelId}` }

      case 'forward':
        if (!action.forwardTo) {
          return { canExecute: false, reason: 'Forward email address is required' }
        }
        return { canExecute: true, reason: `Will forward to ${action.forwardTo}` }

      case 'reply':
        if (!action.replyTemplate) {
          return { canExecute: false, reason: 'Reply template is required' }
        }
        return { canExecute: true, reason: 'Will send reply with template' }

      case 'stop_processing':
        return { canExecute: true, reason: 'Will stop processing further rules' }

      default:
        return { canExecute: false, reason: `Unknown action type: ${action.type}` }
    }
  }

  /**
   * Get action display name
   */
  static getActionDisplayName(action: RuleAction): string {
    switch (action.type) {
      case 'add_label':
        return `Add label "${action.labelId}"`
      case 'remove_label':
        return `Remove label "${action.labelId}"`
      case 'forward':
        return `Forward to "${action.forwardTo}"`
      case 'reply':
        return 'Send reply'
      case 'mark_read':
        return 'Mark as read'
      case 'mark_unread':
        return 'Mark as unread'
      case 'stop_processing':
        return 'Stop processing rules'
      default:
        return action.type.replace('_', ' ')
    }
  }
}