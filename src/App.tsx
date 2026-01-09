import { useAuth } from './lib/AuthContext';
import { Auth } from './components/Auth';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const { user, customer, loading } = useAuth();

  console.log('App render:', { user: user?.id, customer: customer?.id, loading });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <div className="text-slate-600">Loading...</div>
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
