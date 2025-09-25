import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qmhcoafhjudcwazarzui.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaGNvYWZoanVkY3dhemFyenVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyOTIwMzksImV4cCI6MjA3Mzg2ODAzOX0.0P_-BwxFpaudjZnWjTJsa8L15Fi8zi7r6DVBxzDfUxM'

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key exists:', !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY exists:', !!supabaseAnonKey)
  console.warn('Using fallback Supabase configuration')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          role: 'caller' | 'agent'
          name: string
          language: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'caller' | 'agent'
          name: string
          language: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'caller' | 'agent'
          name?: string
          language?: string
          created_at?: string
        }
      }
      call_sessions: {
        Row: {
          id: string
          caller_id: string
          agent_id: string | null
          status: 'waiting' | 'ringing' | 'connected' | 'ended'
          caller_language: string
          agent_language: string | null
          started_at: string
          ended_at: string | null
          duration: number | null
        }
        Insert: {
          id?: string
          caller_id: string
          agent_id?: string | null
          status?: 'waiting' | 'ringing' | 'connected' | 'ended'
          caller_language: string
          agent_language?: string | null
          started_at?: string
          ended_at?: string | null
          duration?: number | null
        }
        Update: {
          id?: string
          caller_id?: string
          agent_id?: string | null
          status?: 'waiting' | 'ringing' | 'connected' | 'ended'
          caller_language?: string
          agent_language?: string | null
          started_at?: string
          ended_at?: string | null
          duration?: number | null
        }
      }
    }
  }
}