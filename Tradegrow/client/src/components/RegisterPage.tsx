import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModal } from './AuthModal';

interface RegisterPageProps {
  onSuccess?: (token: string, user: any) => void;
}

/**
 * Dedicated registration page component accessible at /register (and /signup).
 * Displays the full account creation form asking for Full Mobile Number, Email, and Password.
 */
export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccess }) => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Create Your Account — TradeGrow';
  }, []);

  return (
    <AuthModal
      initialMode="register"
      onModeChange={(mode) => {
        if (mode === 'login') {
          navigate('/login');
        } else {
          navigate('/register');
        }
      }}
      onSuccess={(token: string, user?: any) => {
        if (onSuccess) {
          onSuccess(token, user);
        } else {
          localStorage.setItem('token', token);
          window.location.href = '/';
        }
      }}
    />
  );
};

export default RegisterPage;
