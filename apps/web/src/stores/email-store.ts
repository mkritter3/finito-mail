import { create } from 'zustand'
import type { Email } from '@finito/types'

interface EmailMetadata {
  id: string
  gmail_message_id: string
  gmail_thread_id: string
  subject: string | null
  snippet: string
  from_address: { name: string; email: string } | null
  to_addresses: { name: string; email: string }[]
  received_at: string
  is_read: boolean
}

interface OptimisticUpdate {
  id: string
  updates: Partial<EmailMetadata>
  timestamp: number
}

interface EmailStore {
  selectedEmailId: string | null
  selectedEmailIds: Set<string>
  isComposing: boolean
  draftEmail: Partial<Email> | null
  provider: 'gmail' | 'outlook' | null
  optimisticUpdates: Map<string, OptimisticUpdate>
  bulkActionInProgress: boolean
  
  setSelectedEmail: (id: string | null) => void
  setSelectedEmailId: (id: string | null) => void
  toggleEmailSelection: (id: string) => void
  clearSelection: () => void
  setComposing: (isComposing: boolean) => void
  setDraftEmail: (draft: Partial<Email> | null) => void
  setProvider: (provider: 'gmail' | 'outlook' | null) => void
  applyOptimisticUpdate: (id: string, updates: Partial<EmailMetadata>) => void
  removeOptimisticUpdate: (id: string) => void
  clearOptimisticUpdates: () => void
  setBulkActionInProgress: (inProgress: boolean) => void
  getEmailWithOptimisticUpdates: (email: EmailMetadata) => EmailMetadata
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  selectedEmailId: null,
  selectedEmailIds: new Set(),
  isComposing: false,
  draftEmail: null,
  provider: null,
  optimisticUpdates: new Map(),
  bulkActionInProgress: false,
  
  setSelectedEmail: (id) => set({ selectedEmailId: id }),
  
  setSelectedEmailId: (id) => set({ selectedEmailId: id }),
  
  toggleEmailSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedEmailIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    return { selectedEmailIds: newSet }
  }),
  
  clearSelection: () => set({ selectedEmailIds: new Set() }),
  
  setComposing: (isComposing) => set({ isComposing }),
  
  setDraftEmail: (draft) => set({ draftEmail: draft }),
  
  setProvider: (provider) => set({ provider }),
  
  applyOptimisticUpdate: (id, updates) => set((state) => {
    const newUpdates = new Map(state.optimisticUpdates)
    newUpdates.set(id, {
      id,
      updates,
      timestamp: Date.now()
    })
    return { optimisticUpdates: newUpdates }
  }),
  
  removeOptimisticUpdate: (id) => set((state) => {
    const newUpdates = new Map(state.optimisticUpdates)
    newUpdates.delete(id)
    return { optimisticUpdates: newUpdates }
  }),
  
  clearOptimisticUpdates: () => set({ optimisticUpdates: new Map() }),
  
  setBulkActionInProgress: (inProgress) => set({ bulkActionInProgress: inProgress }),
  
  getEmailWithOptimisticUpdates: (email) => {
    const update = get().optimisticUpdates.get(email.gmail_message_id)
    if (update) {
      return { ...email, ...update.updates }
    }
    return email
  }
}))