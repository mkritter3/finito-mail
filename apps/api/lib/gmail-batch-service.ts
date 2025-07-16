import { GmailClientEnhanced } from '@finito/provider-client';
import { gmail_v1 } from 'googleapis';

export interface BatchAction {
  emailId: string;
  action: 'mark_read' | 'mark_unread' | 'archive' | 'delete' | 'add_label' | 'remove_label';
  labelId?: string;
}

export interface BatchResult {
  emailId: string;
  success: boolean;
  error?: string;
  result?: any;
}

export class GmailBatchService {
  private gmailClient: GmailClientEnhanced;

  constructor(gmailClient: GmailClientEnhanced) {
    this.gmailClient = gmailClient;
  }

  /**
   * Execute batch actions on Gmail messages
   * Processes actions in batches of 10 for optimal performance
   */
  async executeBatchActions(
    client: gmail_v1.Gmail,
    actions: BatchAction[]
  ): Promise<BatchResult[]> {
    const batchSize = 10;
    const batches = [];
    
    // Split actions into batches
    for (let i = 0; i < actions.length; i += batchSize) {
      const batch = actions.slice(i, i + batchSize);
      batches.push(batch);
    }

    const results: BatchResult[] = [];

    // Process each batch
    for (const batch of batches) {
      const batchPromises = batch.map(action => this.executeAction(client, action));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const action = batch[i];
        
        if (result.status === 'fulfilled') {
          results.push({
            emailId: action.emailId,
            success: true,
            result: result.value
          });
        } else {
          results.push({
            emailId: action.emailId,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single Gmail action
   */
  private async executeAction(client: gmail_v1.Gmail, action: BatchAction): Promise<any> {
    const { emailId, action: actionType, labelId } = action;
    
    switch (actionType) {
      case 'mark_read':
        return await this.gmailClient.modifyMessage(client, emailId, [], ['UNREAD']);
      
      case 'mark_unread':
        return await this.gmailClient.modifyMessage(client, emailId, ['UNREAD'], []);
      
      case 'archive':
        return await this.gmailClient.modifyMessage(client, emailId, [], ['INBOX']);
      
      case 'delete':
        return await this.gmailClient.deleteMessage(client, emailId);
      
      case 'add_label':
        if (!labelId) throw new Error('Label ID required for add_label action');
        return await this.gmailClient.modifyMessage(client, emailId, [labelId], []);
      
      case 'remove_label':
        if (!labelId) throw new Error('Label ID required for remove_label action');
        return await this.gmailClient.modifyMessage(client, emailId, [], [labelId]);
      
      default:
        throw new Error(`Unknown action: ${actionType}`);
    }
  }

  /**
   * Create optimistic update data for UI
   */
  static createOptimisticUpdates(actions: BatchAction[]): Record<string, any> {
    const updates: Record<string, any> = {};
    
    for (const action of actions) {
      const emailId = action.emailId;
      
      switch (action.action) {
        case 'mark_read':
          updates[emailId] = { is_read: true };
          break;
        case 'mark_unread':
          updates[emailId] = { is_read: false };
          break;
        case 'archive':
          updates[emailId] = { archived: true };
          break;
        case 'delete':
          updates[emailId] = { deleted: true };
          break;
        case 'add_label':
          updates[emailId] = { 
            labels: { add: [action.labelId] }
          };
          break;
        case 'remove_label':
          updates[emailId] = { 
            labels: { remove: [action.labelId] }
          };
          break;
      }
    }
    
    return updates;
  }

  /**
   * Validate batch actions
   */
  static validateBatchActions(actions: BatchAction[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (actions.length === 0) {
      errors.push('No actions provided');
    }
    
    if (actions.length > 100) {
      errors.push('Too many actions (max 100)');
    }
    
    for (const action of actions) {
      if (!action.emailId || typeof action.emailId !== 'string') {
        errors.push('Invalid email ID');
      }
      
      if (!['mark_read', 'mark_unread', 'archive', 'delete', 'add_label', 'remove_label'].includes(action.action)) {
        errors.push(`Invalid action: ${action.action}`);
      }
      
      if ((action.action === 'add_label' || action.action === 'remove_label') && !action.labelId) {
        errors.push(`Label ID required for ${action.action} action`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}