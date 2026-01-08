import { useAuth } from './lib/AuthContext';
import { Auth } from './components/Auth';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const { user, customer, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
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
