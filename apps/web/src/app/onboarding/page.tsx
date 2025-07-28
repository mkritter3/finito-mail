'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Mail, Users, Tag, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingSuggestion {
  id: string
  user_id: string
  suggestion_type: 'sender_volume' | 'newsletter_group'
  pattern_data: {
    sender?: string
    count: number
    sample_subjects: string[]
  }
  suggested_rule: {
    name: string
    actions: Array<{
      type: string
      value?: string
    }>
  }
  confidence_score: number
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_at: string
  expires_at: string
}

interface OnboardingMetrics {
  suggestions: {
    total_suggestions: number
    by_type: Record<string, Record<string, number>>
    by_status: Record<string, number>
    average_confidence: number
  }
  acceptance: {
    overall_acceptance_rate: number
    by_type: Record<string, any>
  }
  performance: {
    total_pattern_analyses: number
    avg_analysis_time_seconds: number
    users_analyzed: number
  }
  timestamp: string
}

export default function OnboardingPage() {
  const [suggestions, setSuggestions] = useState<OnboardingSuggestion[]>([])
  const [metrics, setMetrics] = useState<OnboardingMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [showMetrics, setShowMetrics] = useState(false)

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/onboarding/suggestions')
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions)
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/onboarding/metrics')
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  const handleAcceptSuggestion = async (suggestion: OnboardingSuggestion) => {
    setProcessingIds(prev => new Set(prev).add(suggestion.id))

    try {
      const response = await fetch(`/api/onboarding/suggestions/${suggestion.id}/accept`, {
        method: 'POST',
      })

      if (response.ok) {
        // Remove from suggestions list
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))

        // Show success message
        console.log('Suggestion accepted successfully')
      } else {
        console.error('Failed to accept suggestion')
      }
    } catch (error) {
      console.error('Error accepting suggestion:', error)
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(suggestion.id)
        return newSet
      })
    }
  }

  const handleRejectSuggestion = async (suggestion: OnboardingSuggestion) => {
    setProcessingIds(prev => new Set(prev).add(suggestion.id))

    try {
      const response = await fetch(`/api/onboarding/suggestions/${suggestion.id}/reject`, {
        method: 'POST',
      })

      if (response.ok) {
        // Remove from suggestions list
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
      } else {
        console.error('Failed to reject suggestion')
      }
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(suggestion.id)
        return newSet
      })
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'sender_volume':
        return <Users className="h-4 w-4" />
      case 'newsletter_group':
        return <Mail className="h-4 w-4" />
      default:
        return <Tag className="h-4 w-4" />
    }
  }

  const getSuggestionTitle = (suggestion: OnboardingSuggestion) => {
    switch (suggestion.suggestion_type) {
      case 'sender_volume':
        return `Auto-organize emails from ${suggestion.pattern_data.sender}`
      case 'newsletter_group':
        return `Group newsletter emails`
      default:
        return 'Email organization suggestion'
    }
  }

  const getSuggestionDescription = (suggestion: OnboardingSuggestion) => {
    const count = suggestion.pattern_data.count
    switch (suggestion.suggestion_type) {
      case 'sender_volume':
        return `You have ${count} emails from ${suggestion.pattern_data.sender}. Create a rule to automatically organize these emails.`
      case 'newsletter_group':
        return `You have ${count} newsletter emails. Create a rule to automatically group and organize them.`
      default:
        return `Organize ${count} emails with this suggested rule.`
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getActionDescription = (actions: Array<{ type: string; value?: string }>) => {
    return actions
      .map(action => {
        switch (action.type) {
          case 'add_label':
            return `Add label: ${action.value}`
          case 'archive':
            return 'Archive automatically'
          case 'mark_read':
            return 'Mark as read'
          case 'stop_processing':
            return 'Stop further processing'
          default:
            return action.type
        }
      })
      .join(', ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Instant Triage</h1>
        </div>
        <p className="text-gray-600">
          We've analyzed your emails and found patterns that could save you time. Accept these
          suggestions to automatically organize your inbox.
        </p>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowMetrics(!showMetrics)
              if (!showMetrics && !metrics) fetchMetrics()
            }}
          >
            {showMetrics ? 'Hide' : 'Show'} Analytics
          </Button>
        </div>
      </div>

      {showMetrics && metrics && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.suggestions.total_suggestions}</div>
              <div className="text-sm text-gray-600">
                {metrics.acceptance.overall_acceptance_rate.toFixed(1)}% acceptance rate
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analysis Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.performance.users_analyzed}</div>
              <div className="text-sm text-gray-600">
                {metrics.performance.avg_analysis_time_seconds.toFixed(1)}s avg analysis
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Confidence Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(metrics.suggestions.average_confidence * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600">Average confidence</div>
            </CardContent>
          </Card>
        </div>
      )}

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-gray-600">
              No new suggestions at the moment. We'll analyze your emails and suggest new rules as
              patterns emerge.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map(suggestion => (
            <Card key={suggestion.id} className="transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSuggestionIcon(suggestion.suggestion_type)}
                    <div>
                      <CardTitle className="text-lg">{getSuggestionTitle(suggestion)}</CardTitle>
                      <CardDescription>{getSuggestionDescription(suggestion)}</CardDescription>
                    </div>
                  </div>
                  <Badge className={cn('text-xs', getConfidenceColor(suggestion.confidence_score))}>
                    {Math.round(suggestion.confidence_score * 100)}% confidence
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Sample subjects */}
                  <div>
                    <h4 className="font-medium mb-2">Sample emails:</h4>
                    <div className="space-y-1">
                      {suggestion.pattern_data.sample_subjects.slice(0, 3).map((subject, index) => (
                        <div key={index} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          {subject}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested rule */}
                  <div>
                    <h4 className="font-medium mb-2">Suggested rule:</h4>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="font-medium text-blue-900">
                        {suggestion.suggested_rule.name}
                      </div>
                      <div className="text-sm text-blue-700 mt-1">
                        Actions: {getActionDescription(suggestion.suggested_rule.actions)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleAcceptSuggestion(suggestion)}
                      disabled={processingIds.has(suggestion.id)}
                      className="flex-1"
                    >
                      {processingIds.has(suggestion.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Accept & Create Rule
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleRejectSuggestion(suggestion)}
                      disabled={processingIds.has(suggestion.id)}
                    >
                      {processingIds.has(suggestion.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Next steps</span>
          </div>
          <p className="text-sm text-blue-800">
            After accepting suggestions, your new rules will automatically organize incoming emails.
            You can modify or disable these rules anytime in the Rules management section.
          </p>
        </div>
      )}
    </div>
  )
}
