import { create } from 'zustand'
import type { Email } from '@finito/types'

interface EmailStore {
  selectedEmailId: string | null
  selectedEmailIds: Set<string>
  isComposing: boolean
  draftEmail: Partial<Email> | null
  provider: 'gmail' | 'outlook' | null
  
  setSelectedEmail: (id: string | null) => void
  toggleEmailSelection: (id: string) => void
  clearSelection: () => void
  setComposing: (isComposing: boolean) => void
  setDraftEmail: (draft: Partial<Email> | null) => void
  setProvider: (provider: 'gmail' | 'outlook' | null) => void
}

export const useEmailStore = create<EmailStore>((set) => ({
  selectedEmailId: null,
  selectedEmailIds: new Set(),
  isComposing: false,
  draftEmail: null,
  provider: null,
  
  setSelectedEmail: (id) => set({ selectedEmailId: id }),
  
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
}))