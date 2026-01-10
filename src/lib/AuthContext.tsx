import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Customer } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  customer: Customer | null;
  loading: boolean;
  signIn: (email: string, password: string, isAdminLogin?: boolean) => Promise<{ error: Error | null }>;
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
      console.log('Initial session check:', session?.user?.id || 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCustomer(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.id || 'No session');
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
    console.log('Loading customer for user:', userId);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error loading customer:', error);
        throw error;
      }

      if (!data) {
        console.error('Customer record not found for user:', userId);
        console.log('Signing out user without customer record...');
        await supabase.auth.signOut();
        setCustomer(null);
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }

      if (data.is_deactivated) {
        console.log('Account is deactivated, signing out...');
        await supabase.auth.signOut();
        setCustomer(null);
        setUser(null);
        setSession(null);
        setLoading(false);
        throw new Error('Account has been deactivated');
      }

      console.log('Customer loaded successfully:', data.email);
      setCustomer(data);
    } catch (error) {
      console.error('Error loading customer:', error);
      if ((error as Error).message === 'Account has been deactivated') {
        throw error;
      }
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string, isAdminLogin: boolean = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error: error as Error };

      if (data.user) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('is_deactivated, role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (customerData?.is_deactivated) {
          await supabase.auth.signOut();
          return { error: new Error('Your account has been deactivated. Please contact support.') };
        }

        const isAdmin = customerData?.role === 'admin';

        if (isAdminLogin && !isAdmin) {
          await supabase.auth.signOut();
          return { error: new Error('This login is for administrators only. Please use the customer login.') };
        }

        if (!isAdminLogin && isAdmin) {
          await supabase.auth.signOut();
          return { error: new Error('Admin accounts must use the Admin Login page.') };
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
          emailRedirectTo: window.location.origin,
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

      // If email confirmation is required, the user won't be in a session yet
      if (authData.session) {
        console.log('User is already authenticated (email confirmation disabled)');
      } else {
        console.log('Email confirmation required - user needs to check their email');
        throw new Error('Please check your email to confirm your account before signing in.');
      }

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
