import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Customer } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  customer: Customer | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCustomer(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadCustomer(session.user.id);
        } else {
          setCustomer(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCustomer = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        console.error('Customer record not found for user:', userId);
        setCustomer(null);
        return;
      }

      if (data.is_deactivated) {
        await supabase.auth.signOut();
        setCustomer(null);
        setUser(null);
        setSession(null);
        throw new Error('Account has been deactivated');
      }

      setCustomer(data);
    } catch (error) {
      console.error('Error loading customer:', error);
      if ((error as Error).message === 'Account has been deactivated') {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error: error as Error };

      if (data.user) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('is_deactivated')
          .eq('id', data.user.id)
          .maybeSingle();

        if (customerData?.is_deactivated) {
          await supabase.auth.signOut();
          return { error: new Error('Your account has been deactivated. Please contact support.') };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || null,
          },
        },
      });

      console.log('Full signup response:', { authData, authError });

      if (authError) {
        console.error('Signup error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Check if user already exists (identities will be empty)
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }

      console.log('User created successfully:', authData.user.id);

      return { error: null };
    } catch (error) {
      console.error('Signup catch error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCustomer(null);
  };

  const refreshCustomer = async () => {
    if (user) {
      await loadCustomer(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, customer, loading, signIn, signUp, signOut, refreshCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
