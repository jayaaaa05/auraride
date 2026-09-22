import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    return (
      localStorage.getItem('auraride_token') ||
      localStorage.getItem('token') ||
      null
    );
  });

  const [user, setUser] = useState(() => {
    try {
      const storedUser =
        localStorage.getItem('auraride_user') || localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const persistSession = useCallback((newToken, newUser) => {
    if (newToken && newUser) {
      localStorage.setItem('auraride_token', newToken);
      localStorage.setItem('token', newToken);
      localStorage.setItem('auraride_user', JSON.stringify(newUser));
      localStorage.setItem('user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
    } else {
      localStorage.removeItem('auraride_token');
      localStorage.removeItem('token');
      localStorage.removeItem('auraride_user');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const verifyStoredSession = async () => {
      if (!token) return;
      try {
        const response = await api.get('/auth/me');
        if (response.data && response.data.user) {
          persistSession(token, response.data.user);
        }
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          persistSession(null, null);
        }
      }
    };

    verifyStoredSession();
  }, [token, persistSession]);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: authToken, user: authUser } = response.data;
      persistSession(authToken, authUser);
      return { success: true, user: authUser, token: authToken };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Unable to sign in. Please check your credentials.';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (registrationData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/register', registrationData);
      const { token: authToken, user: authUser } = response.data;
      persistSession(authToken, authUser);
      return { success: true, user: authUser, token: authToken };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please try again.';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    persistSession(null, null);
    setError(null);
  }, [persistSession]);

  const role = user?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        loading,
        error,
        setError,
        login,
        register,
        logout,
        isAuthenticated: Boolean(token && user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
