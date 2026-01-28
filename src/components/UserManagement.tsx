import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Users, Shield, Lock, XCircle, Check, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';
import type { Admin } from '../types/database';

export function UserManagement() {
  const { admin } = useAuth();
  const [users, setUsers] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showTechnicianModal, setShowTechnicianModal] = useState(false);

  useEffect(() => {
    if (admin) {
      loadUsers();
    }
  }, [admin]);

  const loadUsers = async () => {
    try {
      if (!admin?.shop_id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading admin users:', error);
      showMessage('error', 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('error', 'Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showMessage('success', 'Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      showMessage('error', error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };


  const toggleDeactivateUser = async (userId: string, currentStatus: boolean) => {
    if (userId === admin?.id) {
      showMessage('error', 'You cannot deactivate your own account');
      return;
    }

    try {
      const { error } = await supabase
        .from('admins')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      showMessage('success', `User ${!currentStatus ? 'reactivated' : 'deactivated'}`);
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      showMessage('error', 'Failed to update user status');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading admin users...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Change Password</h3>
              <p className="text-sm text-slate-600">Update your account password</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {message && message.type === 'success' && (
              <div className="text-sm font-medium text-emerald-600">{message.text}</div>
            )}
            {message && message.type === 'error' && (
              <div className="text-sm font-medium text-red-600">{message.text}</div>
            )}
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              <Lock className="w-4 h-4" />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Admin Management</h3>
              <p className="text-sm text-slate-600">Manage admin user accounts</p>
          </div>
        </div>
        <button
          onClick={() => setShowTechnicianModal(true)}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide border border-slate-200 rounded-lg hover:border-slate-400"
        >
          <UserPlus className="w-4 h-4 text-slate-600" />
          Invite technician
        </button>
      </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  User
                </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Status
              </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'bg-slate-50 opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{user.full_name}</div>
                        {user.id === admin?.id && (
                          <div className="text-xs text-emerald-600 font-medium">You</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'technician'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {!user.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        Deactivated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleDeactivateUser(user.id, user.is_active)}
                      disabled={user.id === admin?.id}
                      className="text-red-600 hover:text-red-900 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {!user.is_active ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No admin users found</p>
          </div>
        )}
      </div>

      <CreateTechnicianModal
        isOpen={showTechnicianModal}
        onClose={() => setShowTechnicianModal(false)}
        shopId={admin?.shop_id || null}
        onCreated={() => loadUsers()}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Important Notes</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• This page shows only admin users, not customers</p>
          <p>• You cannot deactivate your own account</p>
          <p>• Deactivated accounts cannot log in but their data is preserved</p>
          <p>• Always ensure at least one admin account remains active</p>
        </div>
      </div>
    </div>
  );
}

interface CreateTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string | null;
  onCreated: () => void;
}

function CreateTechnicianModal({ isOpen, onClose, shopId, onCreated }: CreateTechnicianModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen || !shopId) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !fullName || !password) {
      setError('Provide name, email, and password');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            shop_id: shopId,
            role: 'technician',
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Failed to create technician');
      }

      setSuccess(`Technician invite sent to ${email}`);
      setEmail('');
      setFullName('');
      setPassword('');
      onCreated();
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create technician');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Invite Technician</h2>
            <p className="text-sm text-slate-500">Technician accounts can manage DVIs and service inspections.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Technician full name"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Technician email"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            required
          />

          {error && (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-600 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Invite Technician'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
