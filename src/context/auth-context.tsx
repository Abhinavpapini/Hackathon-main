
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type User = {
  username: string;
  role: 'admin' | 'user';
};

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const users = {
  admin: { password: '12345', role: 'admin' as const },
  test: { password: '12345', role: 'user' as const },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (username: string, password: string) => {
    const foundUser = (users as any)[username];
    if (foundUser && foundUser.password === password) {
      setUser({ username, role: foundUser.role });
    } else {
      throw new Error('Invalid username or password');
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
