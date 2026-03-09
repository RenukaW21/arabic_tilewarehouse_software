import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '@/api/authApi';
import { useAuth } from '@/hooks/useAuth';
import { LoginDto } from '@/types/auth.types';

// ─── Login Page — Full Working Example ───────────────────────────────────────
// Flow: Form Submit → authApi.login() → save tokens → set user → navigate

const LoginPage: React.FC = () => {
  const navigate    = useNavigate();
  const { login }   = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [formData,  setFormData]  = useState<LoginDto>({ email: '', password: '' });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null); // clear previous errors on typing
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic client-side validation
    if (!formData.email || !formData.password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ── API Call ─────────────────────────────────────────────────────────
      // POST /api/v1/auth/login  { email, password }
      // Response: { success, data: { user, tokens: { accessToken, refreshToken } } }
      const res = await authApi.login(formData);

      if (res.success) {
        const { user, tokens } = res.data;

        // ── Save tokens + update context ─────────────────────────────────
        login(user, tokens.accessToken, tokens.refreshToken);

        // ── Success feedback ─────────────────────────────────────────────
        toast.success(`Welcome back, ${user.name}!`);

        // ── Navigate to dashboard ─────────────────────────────────────────
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      // Axios interceptor already shows a toast.
      // Here we also set local error state to display under the form.
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(apiMessage || 'Login failed. Please check your credentials.');
      console.error('[LoginPage] Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to WMS</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="flex flex-col space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              placeholder="admin@example.com"
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              placeholder="••••••••"
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
