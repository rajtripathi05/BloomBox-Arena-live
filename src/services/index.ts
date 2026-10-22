import type { Api } from './api'
import { demoApi } from './demoApi'
import { supabaseApi, supabaseConfigured } from './supabaseApi'

/**
 * Backend selection happens once, from build-time env. Demo mode is only used when Supabase is
 * NOT configured, and the UI labels it. A configured Supabase project never falls back to demo data.
 */
export const api: Api = supabaseConfigured ? supabaseApi : demoApi
export const isDemo = !supabaseConfigured
