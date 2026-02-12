import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('soora_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('soora_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    // Check against registered users in localStorage
    const users = JSON.parse(localStorage.getItem('soora_users') || '[]');
    const found = users.find((u) => u.email === email && u.password === password);
    if (found) {
      const userData = { id: found.id, name: found.name, email: found.email, avatar: found.avatar };
      setUser(userData);
      localStorage.setItem('soora_user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, error: 'Email atau password salah' };
  };

  const register = (name, email, password) => {
    const users = JSON.parse(localStorage.getItem('soora_users') || '[]');
    if (users.find((u) => u.email === email)) {
      return { success: false, error: 'Email sudah terdaftar' };
    }
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=7c5cfc`,
    };
    users.push(newUser);
    localStorage.setItem('soora_users', JSON.stringify(users));
    const userData = { id: newUser.id, name: newUser.name, email: newUser.email, avatar: newUser.avatar };
    setUser(userData);
    localStorage.setItem('soora_user', JSON.stringify(userData));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('soora_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
