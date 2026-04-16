import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function AuthPage() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await axiosInstance.post('/auth/login', {
          email,
          password,
          tenantSlug: tenantName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 50)
        });

        if (res.data?.success) {
          toast.success(t('auth.loggedInSuccess'));
          const { user, accessToken, refreshToken } = res.data.data;
          login(user, accessToken, refreshToken);
          navigate("/");
        }

      } else {
        const payload = {
          tenantName,
          tenantSlug: tenantName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 50),
          adminName: userName,
          adminEmail: email,
          adminPassword: password
        };

        const res = await axiosInstance.post('/auth/register', payload);

        if (res.data?.success) {
          toast.success(t('auth.accountCreated'));
          setIsLogin(true);
        }
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error?.message || t('auth.somethingWentWrong');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-display">{t('app.name')}</CardTitle>
          <CardDescription>
            {isLogin ? t('auth.signInDescription') : t('auth.registerDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-2">
              <Label>{t('auth.companyTenantName')}</Label>
              <Input
                value={tenantName}
                onChange={e => setTenantName(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label>{t('auth.adminName')}</Label>
                <Input
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('auth.email')}</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('auth.password')}</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.pleaseWait') : isLogin ? t('auth.signIn') : t('auth.register')}
            </Button>

          </form>

          <div className="text-center mt-4">
            <button
              type="button"
              className="text-sm text-secondary hover:underline"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin
                ? t('auth.noAccount')
                : t('auth.alreadyHaveAccount')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}