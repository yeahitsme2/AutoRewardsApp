import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

const isDev = import.meta.env.DEV;
const apiUrl = isDev ? window.location.origin + '/supabase' : supabaseUrl;

function isStorageAvailable() {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = isStorageAvailable();

if (!storageAvailable) {
  console.warn('localStorage is not available. Auth sessions may not persist across page refreshes.');
}

export const supabase = createClient<Database>(apiUrl, supabaseAnonKey, {
  auth: {
    persistSession: storageAvailable,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: storageAvailable ? undefined : {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    flowType: 'pkce',
  }
});
