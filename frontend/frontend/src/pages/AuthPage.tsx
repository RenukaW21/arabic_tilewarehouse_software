import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios';
import { useAuth } from '@/hooks/useAuth';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        // local express api /auth/login
        const res = await axiosInstance.post('/auth/login', {
          email,
          password,
          tenantSlug: tenantName.toLowerCase().trim().replace(/[^a-z0-9-]/g, '').substring(0, 50)
        });
        if (res.data?.success) {
          toast.success('Logged in successfully');
          // Update global auth state - pass all 3 args including refreshToken
          const { user, accessToken, refreshToken } = res.data.data;
          login(user, accessToken, refreshToken);
          // console.log("Logged in user:", user);
          // console.log("User Role:", user.role);

        }
      } else {
        // local express api for Tenant registration
        const payload = {
          tenantName,
          tenantSlug: tenantName.toLowerCase().trim().replace(/[^a-z0-9-]/g, '').substring(0, 50),
          adminName: userName,
          adminEmail: email,
          adminPassword: password
        };
        const res = await axiosInstance.post('/auth/register', payload);
        if (res.data?.success) {
          toast.success('Account created! You can now log in.');
          setIsLogin(true); // switch to login view
        }
      }
    } catch (err: any) {
      // Axios global error handling will already display a toast if you configured it, but just in case:
      // toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-display">Tiles WMS</CardTitle>
          <CardDescription>{isLogin ? 'Sign in to your account' : 'Register a new tenant'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName">Company/Tenant Name</Label>
              <Input id="tenantName" value={tenantName} onChange={e => setTenantName(e.target.value)} required placeholder="e.g. tiles-india" />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="userName">Admin Full Name</Label>
                <Input id="userName" value={userName} onChange={e => setUserName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Register'}
            </Button>
          </form>
          <div className="text-center mt-4">
            <button type="button" className="text-sm text-secondary hover:underline" onClick={() => setIsLogin(!isLogin)}>
              {/* {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign in'} */}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
