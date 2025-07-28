#!/usr/bin/env tsx
/**
 * Create demo users in LOCAL Supabase instance for development
 * This script is for local development only, not for staging/production
 * 
 * Usage: npm run demo:create-users
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check we're using local Supabase
if (!SUPABASE_URL.includes('localhost')) {
  console.error('❌ This script is for LOCAL development only!')
  console.error(`   Current URL: ${SUPABASE_URL}`)
  console.error('   Expected: http://localhost:54321')
  process.exit(1)
}

console.log('🚀 Creating demo users in LOCAL Supabase')
console.log(`📍 Target: ${SUPABASE_URL}\n`)

// Demo users for local development
const DEMO_USERS = [
  {
    email: 'alice@demo.local',
    password: 'demo123456',
    name: 'Alice Demo',
    metadata: { 
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
      role: 'user',
      demo_account: true
    }
  },
  {
    email: 'bob@demo.local',
    password: 'demo123456',
    name: 'Bob Demo',
    metadata: { 
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
      role: 'user',
      demo_account: true
    }
  },
  {
    email: 'charlie@demo.local',
    password: 'demo123456',
    name: 'Charlie Demo',
    metadata: { 
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
      role: 'admin',
      demo_account: true
    }
  }
]

// Sample email data generator
function generateSampleEmails(userId: string, userEmail: string, count: number = 10) {
  const subjects = [
    'Weekly Team Meeting Notes',
    'Project Update: Q1 Goals',
    'Important: Security Update Required',
    'Re: Budget Proposal Review',
    'Welcome to Finito Mail!',
    'Your invoice is ready',
    'Reminder: Upcoming deadline',
    'Invitation: Product Launch Event',
    'Action Required: Update your profile',
    'Newsletter: Tech News Digest'
  ]

  const senders = [
    { email: 'team@company.local', name: 'Team Updates' },
    { email: 'boss@company.local', name: 'Your Manager' },
    { email: 'security@finito.local', name: 'Security Team' },
    { email: 'finance@company.local', name: 'Finance Dept' },
    { email: 'support@finito.local', name: 'Finito Support' },
    { email: 'no-reply@service.local', name: 'Automated Service' },
    { email: 'events@company.local', name: 'Events Team' },
    { email: 'hr@company.local', name: 'Human Resources' },
    { email: 'newsletter@tech.local', name: 'Tech News' },
    { email: 'colleague@company.local', name: 'John Colleague' }
  ]

  const emails = []
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    const sender = senders[i % senders.length]
    const subject = subjects[i % subjects.length]
    const daysAgo = Math.floor(Math.random() * 30)
    const hoursAgo = Math.floor(Math.random() * 24)
    const isRead = Math.random() > 0.3 // 70% read

    emails.push({
      user_id: userId,
      gmail_message_id: `demo-${userId}-msg-${i}-${now}`,
      gmail_thread_id: `demo-${userId}-thread-${Math.floor(i / 2)}-${now}`,
      subject: `${subject}${i > 5 ? ' - Follow up' : ''}`,
      snippet: `This is a sample email snippet for ${subject.toLowerCase()}. It contains preview text that would normally show...`,
      from_address: { email: sender.email, name: sender.name },
      to_addresses: [{ email: userEmail, name: userEmail.split('@')[0] }],
      received_at: new Date(now - (daysAgo * 86400000) - (hoursAgo * 3600000)).toISOString(),
      is_read: isRead
    })
  }

  return emails
}

// Sample rules generator
function generateSampleRules(userId: string) {
  return [
    {
      user_id: userId,
      name: 'Archive Old Newsletters',
      description: 'Automatically archive newsletters older than 7 days',
      enabled: true,
      conditions: {
        from: '*@newsletter.local',
        older_than_days: 7
      },
      actions: [
        { type: 'archive' }
      ],
      priority: 1
    },
    {
      user_id: userId,
      name: 'Label Important Emails',
      description: 'Add "Priority" label to emails from boss',
      enabled: true,
      conditions: {
        from: 'boss@company.local'
      },
      actions: [
        { type: 'label', label: 'Priority' }
      ],
      priority: 2
    },
    {
      user_id: userId,
      name: 'Flag Security Alerts',
      description: 'Star and mark important all security emails',
      enabled: true,
      conditions: {
        from: '*@security.local',
        subject_contains: 'security'
      },
      actions: [
        { type: 'star' },
        { type: 'mark_important' }
      ],
      priority: 3
    }
  ]
}

async function createDemoUsers() {
  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const createdUsers = []

  for (const demoUser of DEMO_USERS) {
    try {
      console.log(`\n👤 Creating ${demoUser.email}...`)

      // Try to sign up the user first
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: demoUser.email,
        password: demoUser.password,
        options: {
          data: {
            full_name: demoUser.name,
            ...demoUser.metadata
          }
        }
      })

      if (signUpError) {
        // Try to sign in if user exists
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: demoUser.email,
          password: demoUser.password
        })

        if (signInData?.user) {
          console.log(`   ✓ User already exists (ID: ${signInData.user.id})`)
          createdUsers.push({
            ...demoUser,
            id: signInData.user.id
          })
        } else {
          console.error(`   ❌ Failed to create/sign in: ${signUpError.message}`)
          continue
        }
      } else if (signUpData.user) {
        console.log(`   ✅ Created successfully (ID: ${signUpData.user.id})`)
        createdUsers.push({
          ...demoUser,
          id: signUpData.user.id
        })
      }

      // Create sample data
      const currentUser = createdUsers[createdUsers.length - 1]
      if (currentUser?.id) {
        console.log(`   📧 Creating sample emails...`)
        
        // Generate and insert emails
        const emails = generateSampleEmails(currentUser.id, demoUser.email, 15)
        const { error: emailError } = await supabase
          .from('email_metadata')
          .insert(emails)

        if (emailError) {
          console.log(`   ⚠️  Could not create emails: ${emailError.message}`)
        } else {
          console.log(`   ✓ Created ${emails.length} sample emails`)
        }

        // Generate and insert rules
        console.log(`   📏 Creating sample rules...`)
        const rules = generateSampleRules(currentUser.id)
        
        for (const rule of rules) {
          const { data: ruleData, error: ruleError } = await supabase
            .from('email_rules_v2')
            .insert({
              user_id: rule.user_id,
              name: rule.name,
              description: rule.description,
              enabled: rule.enabled,
              conditions: rule.conditions,
              priority: rule.priority
            })
            .select()
            .single()

          if (!ruleError && ruleData) {
            // Create rule actions
            const actions = rule.actions.map(action => ({
              rule_id: ruleData.id,
              action_type: action.type,
              parameters: action
            }))

            await supabase
              .from('rule_actions')
              .insert(actions)
          }
        }
        
        console.log(`   ✓ Created ${rules.length} sample rules`)
        
        // Sign out to prepare for next user
        await supabase.auth.signOut()
      }

    } catch (error) {
      console.error(`\n❌ Unexpected error for ${demoUser.email}:`, error)
    }
  }

  // Output summary
  console.log('\n' + '='.repeat(60))
  console.log('📋 Demo Users Created')
  console.log('='.repeat(60) + '\n')

  if (createdUsers.length === 0) {
    console.log('❌ No users were created')
    return
  }

  createdUsers.forEach((user) => {
    console.log(`✅ ${user.name} (${user.metadata.role})`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Password: ${user.password}`)
    console.log(`   ID: ${user.id}`)
    console.log('')
  })

  console.log('🎉 Demo environment ready!')
  console.log('\n📝 You can now:')
  console.log('1. Sign in with any demo account at http://localhost:3000')
  console.log('2. Test RLS policies between different users')
  console.log('3. Run automated tests with these accounts')
}

// Run the script
createDemoUsers()
  .then(() => {
    console.log('\n✅ Demo setup complete!')
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })