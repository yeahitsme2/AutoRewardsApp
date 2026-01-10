import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';

interface Shop {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ShopContextType {
  shop: Shop | null;
  loading: boolean;
  error: string | null;
  setShopBySlug: (slug: string) => Promise<void>;
}

const ShopContext = createContext<ShopContextType>({
  shop: null,
  loading: true,
  error: null,
  setShopBySlug: async () => {},
});

export function useShop() {
  return useContext(ShopContext);
}

function getShopSlugFromUrl(): string {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  const pathMatch = pathname.match(/^\/shop\/([^/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0];
  }

  const params = new URLSearchParams(window.location.search);
  const shopParam = params.get('shop');
  if (shopParam) {
    return shopParam;
  }

  return 'default';
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShop = async (slug: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('shops')
        .select('id, name, slug, is_active')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading shop:', fetchError);
        setError('Failed to load shop');
        return;
      }

      if (!data) {
        const { data: firstShop } = await supabase
          .from('shops')
          .select('id, name, slug, is_active')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (firstShop) {
          setShop(firstShop);
          return;
        }
        setError('Shop not found');
        return;
      }

      setShop(data);
    } catch (err) {
      console.error('Error loading shop:', err);
      setError('Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

  const setShopBySlug = async (slug: string) => {
    await loadShop(slug);
  };

  useEffect(() => {
    const slug = getShopSlugFromUrl();
    loadShop(slug);
  }, []);

  return (
    <ShopContext.Provider value={{ shop, loading, error, setShopBySlug }}>
      {children}
    </ShopContext.Provider>
  );
}
