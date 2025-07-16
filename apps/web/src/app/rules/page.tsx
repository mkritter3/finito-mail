'use client'

import { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, GripVertical, Settings, Plus, Play, Pause, Edit3, Trash2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmailRule {
  id: string
  user_id: string
  name: string
  description?: string
  conditions: {
    operator: 'AND' | 'OR'
    rules: Array<{
      field: string
      operator: string
      value: string
    }>
  }
  actions: Array<{
    type: string
    value?: string
  }>
  priority: number
  enabled: boolean
  created_at: string
  updated_at: string
}

interface RulesStats {
  total_rules: number
  active_rules: number
  total_executions: number
  success_rate: number
  avg_execution_time: number
  most_triggered_rules: Array<{
    rule_id: string
    rule_name: string
    execution_count: number
    success_rate: number
  }>
}

function SortableRuleCard({ rule, onToggle, onEdit, onDelete }: {
  rule: EmailRule
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (rule: EmailRule) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getActionDescription = (actions: Array<{ type: string; value?: string }>) => {
    return actions.map(action => {
      switch (action.type) {
        case 'add_label':
          return `Label: ${action.value}`
        case 'archive':
          return 'Archive'
        case 'mark_read':
          return 'Mark read'
        case 'mark_unread':
          return 'Mark unread'
        case 'delete':
          return 'Delete'
        case 'forward':
          return `Forward to ${action.value}`
        case 'reply':
          return 'Auto-reply'
        case 'stop_processing':
          return 'Stop processing'
        default:
          return action.type
      }
    }).join(', ')
  }

  const getConditionDescription = (conditions: EmailRule['conditions']) => {
    if (!conditions?.rules?.length) return 'No conditions'
    
    const descriptions = conditions.rules.map(rule => {
      const fieldName = rule.field.replace('_', ' ')
      let operatorText = rule.operator
      
      switch (rule.operator) {
        case 'contains':
          operatorText = 'contains'
          break
        case 'equals':
          operatorText = 'equals'
          break
        case 'starts_with':
          operatorText = 'starts with'
          break
        case 'ends_with':
          operatorText = 'ends with'
          break
        case 'regex':
          operatorText = 'matches'
          break
        default:
          operatorText = rule.operator
      }
      
      return `${fieldName} ${operatorText} "${rule.value}"`
    })
    
    return descriptions.join(` ${conditions.operator} `)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-200',
        isDragging && 'opacity-50 scale-95'
      )}
    >
      <Card className={cn(
        'group hover:shadow-md transition-shadow',
        !rule.enabled && 'opacity-60'
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
              </button>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  #{rule.priority}
                </Badge>
                <div>
                  <CardTitle className="text-sm">{rule.name}</CardTitle>
                  {rule.description && (
                    <CardDescription className="text-xs mt-1">
                      {rule.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) => onToggle(rule.id, checked)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(rule)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(rule.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">CONDITIONS</h4>
              <div className="text-sm bg-gray-50 p-2 rounded">
                {getConditionDescription(rule.conditions)}
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">ACTIONS</h4>
              <div className="text-sm bg-blue-50 p-2 rounded">
                {getActionDescription(rule.actions)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RulesPage() {
  const [rules, setRules] = useState<EmailRule[]>([])
  const [stats, setStats] = useState<RulesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [updating, setUpdating] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules)
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/rules/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleDragEnd = async (event: any) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const oldIndex = rules.findIndex(rule => rule.id === active.id)
      const newIndex = rules.findIndex(rule => rule.id === over.id)

      const newRules = arrayMove(rules, oldIndex, newIndex)
      
      // Update local state immediately for smooth UX
      setRules(newRules)

      // Update priorities on backend
      try {
        const bulkUpdates = newRules.map((rule, index) => ({
          id: rule.id,
          priority: index + 1
        }))

        await fetch('/api/rules/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            operation: 'update_priorities',
            rules: bulkUpdates
          })
        })
      } catch (error) {
        console.error('Error updating priorities:', error)
        // Revert on error
        fetchRules()
      }
    }
  }

  const handleToggleRule = async (id: string, enabled: boolean) => {
    setUpdating(prev => new Set(prev).add(id))
    
    try {
      const response = await fetch(`/api/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      
      if (response.ok) {
        setRules(prev => prev.map(rule => 
          rule.id === id ? { ...rule, enabled } : rule
        ))
      }
    } catch (error) {
      console.error('Error toggling rule:', error)
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const handleEditRule = (rule: EmailRule) => {
    // TODO: Open edit modal
    console.log('Edit rule:', rule)
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const response = await fetch(`/api/rules/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setRules(prev => prev.filter(rule => rule.id !== id))
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold">Rules Management</h1>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowStats(!showStats)
                if (!showStats && !stats) fetchStats()
              }}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showStats ? 'Hide' : 'Show'} Statistics
            </Button>
            
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </div>
        
        <p className="text-gray-600">
          Manage your email automation rules. Drag and drop to reorder priority.
        </p>
      </div>

      {showStats && stats && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_rules}</div>
              <div className="text-sm text-gray-600">
                {stats.active_rules} active
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_executions}</div>
              <div className="text-sm text-gray-600">
                {stats.success_rate.toFixed(1)}% success rate
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_execution_time.toFixed(1)}ms</div>
              <div className="text-sm text-gray-600">Average execution time</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Most Active</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.most_triggered_rules.length > 0 ? (
                <div>
                  <div className="text-sm font-medium">{stats.most_triggered_rules[0].rule_name}</div>
                  <div className="text-sm text-gray-600">
                    {stats.most_triggered_rules[0].execution_count} executions
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No executions yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {rules.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No rules yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first rule to start automating your email workflow.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {rules.length} rules • Drag to reorder priority
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Play className="h-4 w-4 mr-1" />
                Test All
              </Button>
              <Button variant="outline" size="sm">
                <Pause className="h-4 w-4 mr-1" />
                Disable All
              </Button>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={rules.map(rule => rule.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <SortableRuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={handleToggleRule}
                    onEdit={handleEditRule}
                    onDelete={handleDeleteRule}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}