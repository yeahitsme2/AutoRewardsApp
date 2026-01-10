import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Customer, SuperAdmin } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  customer: Customer | null;
  superAdmin: SuperAdmin | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, shopId: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          setCustomer(null);
          setSuperAdmin(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const { data: superAdminData, error: superAdminError } = await supabase
        .from('super_admins')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (superAdminError) {
        console.error('Error checking super admin:', superAdminError);
      }

      if (superAdminData) {
        setSuperAdmin(superAdminData);
        setCustomer(null);
        setLoading(false);
        return;
      }

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (customerError) {
        console.error('Error loading customer:', customerError);
      }

      if (!customerData) {
        if (!superAdminData && !superAdminError) {
          setCustomer(null);
          setSuperAdmin(null);
        }
        setLoading(false);
        return;
      }

      if (customerData.is_deactivated) {
        await supabase.auth.signOut();
        setCustomer(null);
        setSuperAdmin(null);
        setUser(null);
        setSession(null);
        setAuthError('Your account has been deactivated.');
        setLoading(false);
        return;
      }

      setCustomer(customerData);
      setSuperAdmin(null);
    } catch (error) {
      console.error('Error loading user data:', error);
      setCustomer(null);
      setSuperAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        return { error: error as Error };
      }

      return { error: null };
    } catch (error) {
      setAuthError((error as Error).message);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, shopId: string, phone?: string) => {
    try {
      setAuthError(null);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            shop_id: shopId,
          },
        },
      });

      if (authError) {
        setAuthError(authError.message);
        return { error: authError as Error };
      }

      if (!authData.user) {
        setAuthError('Failed to create account');
        return { error: new Error('Failed to create account') };
      }

      if (authData.user.identities && authData.user.identities.length === 0) {
        setAuthError('An account with this email already exists.');
        return { error: new Error('An account with this email already exists.') };
      }

      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          auth_user_id: authData.user.id,
          shop_id: shopId,
          email,
          full_name: fullName,
          phone: phone || null,
        });

      if (customerError) {
        console.error('Error creating customer:', customerError);
        setAuthError(customerError.message);
        return { error: customerError as Error };
      }

      return { error: null };
    } catch (error) {
      setAuthError((error as Error).message);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCustomer(null);
    setSuperAdmin(null);
    setAuthError(null);
  };

  const refreshCustomer = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      customer,
      superAdmin,
      loading,
      authError,
      clearAuthError,
      signIn,
      signUp,
      signOut,
      refreshCustomer
    }}>
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
