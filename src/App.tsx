import { useEffect } from 'react';
import { useAuth } from './lib/AuthContext';
import { useShop } from './lib/ShopContext';
import { Auth } from './components/Auth';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';

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

  return '';
}

function App() {
  const { user, customer, admin, superAdmin, loading, signOut } = useAuth();
  const { shop, loading: shopLoading, setShopById, setShopBySlug } = useShop();

  useEffect(() => {
    if (loading) return;

    if (admin?.shop_id) {
      setShopById(admin.shop_id);
    } else if (customer?.shop_id) {
      setShopById(customer.shop_id);
    } else if (!user) {
      const slug = getShopSlugFromUrl();
      if (slug) {
        setShopBySlug(slug);
      }
    }
  }, [admin?.shop_id, customer?.shop_id, loading, user]);

  if (loading || (user && (admin || customer) && shopLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
          <div className="text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (superAdmin) {
    return <SuperAdminDashboard superAdmin={superAdmin} onSignOut={signOut} />;
  }

  if (admin) {
    return <AdminDashboard />;
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Account Not Found</h1>
          <p className="text-slate-600 mb-6">
            Your account is not associated with any shop. Please contact an administrator.
          </p>
          <button
            onClick={signOut}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <CustomerDashboard />;
}

export default App;
