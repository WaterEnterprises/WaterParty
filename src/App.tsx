/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './lib/ThemeContext';
import { BottomNav } from './components/BottomNav';
import { SwipePage } from './pages/SwipePage';
import { MessagesPage } from './pages/MessagesPage';
import { CreatePartyPage } from './pages/CreatePartyPage';
import { ChatRoomPage } from './pages/ChatRoomPage';
import { ProfilePage } from './pages/ProfilePage';
import { WalletPage } from './pages/WalletPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { PrivacyPage } from './pages/PrivacyPage';
import { useEffect } from 'react';
import { StoreProvider, useStore } from './lib/Store';
import { AuthPage } from './pages/AuthPage';
import { useBackButton } from './hooks/useBackButton';
import { usePushNotifications } from './hooks/usePushNotifications';
import { ToastProvider } from './hooks/useToast';

function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useStore();
  usePushNotifications();

  // Centralized back button handler for Android hardware back + all routes
  useBackButton((path) => {
    // /chat/ handled by ChatRoomPage's own listener (preserves activeTab state)
    if (path.startsWith('/chat/')) return;
    if (path.startsWith('/admin') || path === '/wallet') {
      navigate('/profile');
      return;
    }
    if (path === '/messages' || path === '/create' || path === '/profile') {
      navigate('/');
    }
    // On '/' (SwipePage), the per-page overlay handler takes priority
  });
  
  // Restore scroll position when navigating back
  useEffect(() => {
    const handlePopState = () => {
      // Re-read user from store on back navigation
      const stored = localStorage.getItem('waterparty_user');
      if (stored && !user) {
        window.location.reload();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);
  
  // Privacy page is publicly accessible (no auth required)
  if (location.pathname === '/privacy') {
    return (
      <PrivacyPage />
    );
  }
  
  if (!user) return <AuthPage />;

  return (
    <div className="bg-base h-[100dvh] w-full font-sans text-text-primary flex flex-col overflow-hidden selection:bg-[#00D2FF]/30">
      
      {/* Main Panel */}
      <div className="flex-1 relative flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Core Screen Space with custom responsive constraints */}
        <main className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#121320] to-overlay">
          <Routes>
            <Route path="/" element={<SwipePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/chat/:chatId" element={<ChatRoomPage />} />
            <Route path="/create" element={<CreatePartyPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/admin" element={user?.IsAdmin ? <AdminDashboard /> : <ProfilePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </main>
        
        {/* Bottom Navigation — safe-area-aware padding for notched devices */}
        {!location.pathname.startsWith('/chat/') && (
          <div className="fixed bottom-0 left-0 w-full h-[64px] z-[100]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <BottomNav />
          </div>
        )}
        
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <StoreProvider>
            <MainApp />
          </StoreProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
}
