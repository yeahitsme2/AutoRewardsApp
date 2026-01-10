import { useAuth } from './lib/AuthContext';
import { useShop } from './lib/ShopContext';
import { Auth } from './components/Auth';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const { shop, loading: shopLoading, error: shopError } = useShop();
  const { user, customer, loading: authLoading } = useAuth();

  console.log('App render:', { shop: shop?.slug, user: user?.id, customer: customer?.id, shopLoading, authLoading });

  if (shopLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <div className="text-slate-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (shopError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Shop Not Found</h1>
          <p className="text-slate-600">The shop you're looking for doesn't exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  if (!user || !customer) {
    return <Auth />;
  }

  if (customer.is_admin) {
    return <AdminDashboard />;
  }

  return <CustomerDashboard />;
}

export default App;
