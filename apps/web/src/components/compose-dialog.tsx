'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Paperclip, Image, Link, Smile, MoreVertical } from 'lucide-react'
import { Button } from '@finito/ui'
// import { useEmailStore } from '@/stores/email-store'
// import { useAuth } from '@/hooks/use-auth'
import { sendEmail } from '@/app/actions/email-sync'
import type { EmailAddress } from '@finito/types'

interface ComposeDialogProps {
  isOpen: boolean
  onClose: () => void
  replyTo?: {
    id: string
    subject: string
    from: EmailAddress
    to: EmailAddress[]
    cc?: EmailAddress[]
    threadId: string
  }
  mode?: 'compose' | 'reply' | 'replyAll' | 'forward'
}

export function ComposeDialog({ isOpen, onClose, replyTo, mode = 'compose' }: ComposeDialogProps) {
  // const { } = useAuth()
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Set initial values based on mode
      if (mode === 'reply' && replyTo) {
        setTo(replyTo.from.email)
        setSubject(`Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}`)
        setBody(
          `\n\nOn ${new Date().toLocaleDateString()}, ${replyTo.from.name || replyTo.from.email} wrote:\n> ${getQuotedText()}`
        )
      } else if (mode === 'replyAll' && replyTo) {
        const toAddresses = [
          replyTo.from,
          ...replyTo.to.filter(addr => addr.email !== 'user@gmail.com'),
        ]
        setTo(toAddresses.map(addr => addr.email).join(', '))
        if (replyTo.cc && replyTo.cc.length > 0) {
          setCc(replyTo.cc.map(addr => addr.email).join(', '))
          setShowCc(true)
        }
        setSubject(`Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}`)
        setBody(
          `\n\nOn ${new Date().toLocaleDateString()}, ${replyTo.from.name || replyTo.from.email} wrote:\n> ${getQuotedText()}`
        )
      } else if (mode === 'forward' && replyTo) {
        setSubject(`Fwd: ${replyTo.subject.replace(/^Fwd:\s*/i, '')}`)
        setBody(
          `\n\n---------- Forwarded message ---------\nFrom: ${replyTo.from.name || replyTo.from.email} <${replyTo.from.email}>\nDate: ${new Date().toLocaleDateString()}\nSubject: ${replyTo.subject}\nTo: ${replyTo.to.map(addr => addr.email).join(', ')}\n\n${getQuotedText()}`
        )
      } else {
        // Clear for new compose
        setTo('')
        setCc('')
        setBcc('')
        setSubject('')
        setBody('')
        setShowCc(false)
        setShowBcc(false)
      }

      // Focus the appropriate field
      setTimeout(() => {
        if (mode === 'compose') {
          document.getElementById('compose-to')?.focus()
        } else {
          bodyRef.current?.focus()
          bodyRef.current?.setSelectionRange(0, 0)
        }
      }, 100)
    }
  }, [isOpen, mode, replyTo])

  const getQuotedText = () => {
    // In a real app, this would get the actual email body
    return 'Previous email content would be quoted here...'
  }

  const handleSend = async () => {
    if (!to || !subject) return

    try {
      setIsSending(true)

      // Use Server Action to send email
      const result = await sendEmail({
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body,
        threadId: mode !== 'compose' ? replyTo?.threadId : undefined,
      })

      if (result.data?.success) {
        // Close dialog and show success
        onClose()
        console.log('Email sent successfully', {
          messageId: result.data.messageId,
          threadId: result.data.threadId,
        })
      } else {
        console.error('Failed to send email:', result.error)
        // In a real app, show an error toast
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      // In a real app, show an error toast
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 w-[600px] max-h-[80vh] bg-background border border-border rounded-lg shadow-2xl z-50 flex flex-col"
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {mode === 'compose'
                  ? 'New Message'
                  : mode === 'reply'
                    ? 'Reply'
                    : mode === 'replyAll'
                      ? 'Reply All'
                      : 'Forward'}
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3">
                {/* To */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="compose-to"
                    className="text-sm font-medium text-muted-foreground w-12"
                  >
                    To
                  </label>
                  <input
                    id="compose-to"
                    type="email"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    placeholder="Recipients"
                    className="flex-1 px-3 py-1.5 text-sm bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    multiple
                  />
                  <button
                    onClick={() => setShowCc(!showCc)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cc
                  </button>
                  <button
                    onClick={() => setShowBcc(!showBcc)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Bcc
                  </button>
                </div>

                {/* Cc */}
                {showCc && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="compose-cc"
                      className="text-sm font-medium text-muted-foreground w-12"
                    >
                      Cc
                    </label>
                    <input
                      id="compose-cc"
                      type="email"
                      value={cc}
                      onChange={e => setCc(e.target.value)}
                      placeholder="Cc recipients"
                      className="flex-1 px-3 py-1.5 text-sm bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      multiple
                    />
                  </div>
                )}

                {/* Bcc */}
                {showBcc && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="compose-bcc"
                      className="text-sm font-medium text-muted-foreground w-12"
                    >
                      Bcc
                    </label>
                    <input
                      id="compose-bcc"
                      type="email"
                      value={bcc}
                      onChange={e => setBcc(e.target.value)}
                      placeholder="Bcc recipients"
                      className="flex-1 px-3 py-1.5 text-sm bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      multiple
                    />
                  </div>
                )}

                {/* Subject */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="compose-subject"
                    className="text-sm font-medium text-muted-foreground w-12"
                  >
                    Subject
                  </label>
                  <input
                    id="compose-subject"
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="flex-1 px-3 py-1.5 text-sm bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  />
                </div>

                {/* Body */}
                <div className="mt-2">
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Compose your message..."
                    className="w-full min-h-[300px] px-3 py-2 text-sm bg-transparent border-0 outline-none resize-none focus:ring-1 focus:ring-blue-500 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <button
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Insert image"
                >
                  <Image className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Insert link"
                >
                  <Link className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Insert emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {isSending ? 'Sending...' : 'Press Cmd+Enter to send'}
                </span>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !to || !subject}
                  size="sm"
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
