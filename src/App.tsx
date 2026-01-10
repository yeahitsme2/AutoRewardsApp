import { useAuth } from './lib/AuthContext';
import { Auth } from './components/Auth';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';

function App() {
  const { user, customer, superAdmin, loading, signOut } = useAuth();

  if (loading) {
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

  if (customer.is_admin) {
    return <AdminDashboard />;
  }

  return <CustomerDashboard />;
}

export default App;
