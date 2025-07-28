'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@finito/ui'

export default function TestAuthPage() {
  const [status, setStatus] = useState<string[]>([])
  const [email, setEmail] = useState('alice@demo.local')
  const [password, setPassword] = useState('demo123456')
  const supabase = createClient()

  const addStatus = (message: string) => {
    setStatus((prev) => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  useEffect(() => {
    addStatus('Page loaded')
    addStatus(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  }, [])

  const testEmailSignIn = async () => {
    addStatus('Testing email sign in...')
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        addStatus(`❌ Error: ${error.message}`)
        addStatus(`   Code: ${error.code}`)
        addStatus(`   Status: ${error.status}`)
      } else {
        addStatus('✅ Sign in successful!')
        addStatus(`   User ID: ${data.user?.id}`)
        addStatus(`   Email: ${data.user?.email}`)
        addStatus(`   Session: ${data.session ? 'Active' : 'None'}`)
      }
    } catch (err) {
      addStatus(`❌ Exception: ${err}`)
    }
  }

  const testEmailSignUp = async () => {
    addStatus('Testing email sign up...')
    
    try {
      const testEmail = `test-${Date.now()}@demo.local`
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456',
      })
      
      if (error) {
        addStatus(`❌ Error: ${error.message}`)
        addStatus(`   Code: ${error.code}`)
      } else {
        addStatus('✅ Sign up successful!')
        addStatus(`   User ID: ${data.user?.id}`)
        addStatus(`   Email: ${data.user?.email}`)
      }
    } catch (err) {
      addStatus(`❌ Exception: ${err}`)
    }
  }

  const checkSession = async () => {
    addStatus('Checking session...')
    
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      addStatus(`❌ Session error: ${error.message}`)
    } else {
      addStatus(`Session: ${data.session ? 'Active' : 'None'}`)
      if (data.session) {
        addStatus(`   User: ${data.session.user.email}`)
        addStatus(`   Expires: ${new Date(data.session.expires_at! * 1000).toISOString()}`)
      }
    }
  }

  const signOut = async () => {
    addStatus('Signing out...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      addStatus(`❌ Sign out error: ${error.message}`)
    } else {
      addStatus('✅ Signed out')
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Auth Test Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            
            <div className="space-y-2">
              <Button onClick={testEmailSignIn} className="w-full">
                Test Email Sign In
              </Button>
              
              <Button onClick={testEmailSignUp} variant="outline" className="w-full">
                Test Email Sign Up (New User)
              </Button>
              
              <Button onClick={checkSession} variant="outline" className="w-full">
                Check Session
              </Button>
              
              <Button onClick={signOut} variant="outline" className="w-full">
                Sign Out
              </Button>
              
              <Button 
                onClick={() => setStatus([])} 
                variant="ghost" 
                className="w-full"
              >
                Clear Log
              </Button>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Demo Users:</p>
              <ul className="ml-4 mt-1">
                <li>alice@demo.local / demo123456</li>
                <li>bob@demo.local / demo123456</li>
                <li>charlie@demo.local / demo123456</li>
              </ul>
            </div>
          </div>
          
          {/* Status Log */}
          <div className="bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-auto h-96">
            {status.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              status.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}