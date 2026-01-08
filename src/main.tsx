import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext';
import { BrandProvider } from './lib/BrandContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrandProvider>
  </StrictMode>
);
