import { RuleCondition, RuleAction, EmailContext, RuleEvaluationContext, RuleExecutionResult } from './types'

export class RuleEvaluator {
  /**
   * Evaluate if an email matches a set of conditions
   * All conditions must be true for the rule to match (AND logic)
   */
  static evaluateConditions(conditions: RuleCondition[], context: RuleEvaluationContext): boolean {
    if (!conditions || conditions.length === 0) {
      return false
    }

    return conditions.every(condition => this.evaluateCondition(condition, context))
  }

  /**
   * Evaluate a single condition against an email
   */
  static evaluateCondition(condition: RuleCondition, context: RuleEvaluationContext): boolean {
    const { email } = context
    const { field, operator, value, case_sensitive = false } = condition

    // Get the field value from the email
    const fieldValue = this.getFieldValue(field, email)
    if (fieldValue === null || fieldValue === undefined) {
      return false
    }

    // Normalize values for comparison
    const normalizedFieldValue = case_sensitive ? fieldValue : fieldValue.toLowerCase()
    const normalizedValue = case_sensitive ? value : value.toLowerCase()

    switch (operator) {
      case 'equals':
        return normalizedFieldValue === normalizedValue

      case 'contains':
        return normalizedFieldValue.includes(normalizedValue)

      case 'starts_with':
        return normalizedFieldValue.startsWith(normalizedValue)

      case 'ends_with':
        return normalizedFieldValue.endsWith(normalizedValue)

      case 'not_equals':
        return normalizedFieldValue !== normalizedValue

      case 'not_contains':
        return !normalizedFieldValue.includes(normalizedValue)

      case 'regex':
        try {
          const regex = new RegExp(value, case_sensitive ? 'g' : 'gi')
          return regex.test(fieldValue)
        } catch (error) {
          console.error('Invalid regex pattern:', value, error)
          return false
        }

      default:
        console.warn('Unknown operator:', operator)
        return false
    }
  }

  /**
   * Get field value from email context
   */
  private static getFieldValue(field: string, email: EmailContext): string | null {
    switch (field) {
      case 'from':
        return email.from_address?.email || null

      case 'to':
        return email.to_addresses?.map(addr => addr.email).join(', ') || null

      case 'subject':
        return email.subject || null

      case 'body_contains':
        return email.snippet || null

      case 'sender_domain':
        if (email.from_address?.email) {
          const domain = email.from_address.email.split('@')[1]
          return domain || null
        }
        return null

      case 'has_attachment':
        return email.has_attachment ? 'true' : 'false'

      default:
        console.warn('Unknown field:', field)
        return null
    }
  }

  /**
   * Test rule conditions against an email (for testing/preview)
   */
  static testConditions(
    conditions: RuleCondition[],
    context: RuleEvaluationContext
  ): Array<{ condition: RuleCondition; matched: boolean; reason?: string }> {
    return conditions.map(condition => {
      const matched = this.evaluateCondition(condition, context)
      const fieldValue = this.getFieldValue(condition.field, context.email)
      
      return {
        condition,
        matched,
        reason: matched 
          ? `Field '${condition.field}' (${fieldValue}) matches '${condition.value}'`
          : `Field '${condition.field}' (${fieldValue}) does not match '${condition.value}'`
      }
    })
  }

  /**
   * Validate rule conditions
   */
  static validateConditions(conditions: RuleCondition[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!conditions || conditions.length === 0) {
      errors.push('At least one condition is required')
      return { valid: false, errors }
    }

    for (const condition of conditions) {
      if (!condition.field) {
        errors.push('Condition field is required')
        continue
      }

      if (!condition.operator) {
        errors.push('Condition operator is required')
        continue
      }

      if (!condition.value) {
        errors.push('Condition value is required')
        continue
      }

      // Validate regex patterns
      if (condition.operator === 'regex') {
        try {
          new RegExp(condition.value)
        } catch (error) {
          errors.push(`Invalid regex pattern: ${condition.value}`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Validate rule actions
   */
  static validateActions(actions: RuleAction[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!actions || actions.length === 0) {
      errors.push('At least one action is required')
      return { valid: false, errors }
    }

    for (const action of actions) {
      if (!action.type) {
        errors.push('Action type is required')
        continue
      }

      // Validate label actions
      if (['add_label', 'remove_label'].includes(action.type) && !action.labelId) {
        errors.push(`Action ${action.type} requires labelId`)
      }

      // Validate forward action
      if (action.type === 'forward' && !action.forwardTo) {
        errors.push('Forward action requires forwardTo email address')
      }

      // Validate reply action
      if (action.type === 'reply' && !action.replyTemplate) {
        errors.push('Reply action requires replyTemplate')
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Get human-readable description of conditions
   */
  static getConditionsDescription(conditions: RuleCondition[]): string {
    if (!conditions || conditions.length === 0) {
      return 'No conditions'
    }

    const descriptions = conditions.map(condition => {
      const fieldName = condition.field.replace('_', ' ')
      const operatorName = condition.operator.replace('_', ' ')
      return `${fieldName} ${operatorName} "${condition.value}"`
    })

    return descriptions.join(' AND ')
  }

  /**
   * Get human-readable description of actions
   */
  static getActionsDescription(actions: RuleAction[]): string {
    if (!actions || actions.length === 0) {
      return 'No actions'
    }

    const descriptions = actions.map(action => {
      switch (action.type) {
        case 'add_label':
          return `add label "${action.labelId}"`
        case 'remove_label':
          return `remove label "${action.labelId}"`
        case 'forward':
          return `forward to "${action.forwardTo}"`
        case 'reply':
          return `reply with template`
        default:
          return action.type.replace('_', ' ')
      }
    })

    return descriptions.join(', ')
  }
}