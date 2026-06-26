import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, DollarSign, Users, PartyPopper, CreditCard, TrendingUp, Bell, Loader } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { API_BASE, fetchWithAuth } from "../lib/constants";

interface RevenueData {
  totalContributions: number;
  totalCollected: number;
  totalFees: number;
  totalToParties: number;
  platformFeePercent: number;
}

interface PlatformStats {
  totalUsers: number;
  totalParties: number;
  totalContributions: number;
  totalWithdrawals: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [revRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/api/platform/revenue`),
          fetch(`${API_BASE}/api/platform/stats`),
        ]);

        if (revRes.ok) setRevenue(await revRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch (e: any) {
        setError(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-overlay">
        <header className="px-4 py-4 flex items-center gap-3 border-b border-border-default bg-card shrink-0">
          <button
            onClick={() => navigate("/profile")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-text-muted active:scale-95 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-sm font-black text-text-primary uppercase tracking-widest">Admin Dashboard</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand-accent/30 border-t-brand-accent animate-spin" />
            <p className="text-tiny font-bold text-text-faint uppercase tracking-widest animate-pulse">Loading metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-overlay">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-3 border-b border-border-default bg-card shrink-0">
        <button
          onClick={() => navigate("/profile")}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-text-muted active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-sm font-black text-text-primary uppercase tracking-widest">Admin Dashboard</h1>
          <p className="text-nano font-bold text-text-faint uppercase tracking-wider">Platform Metrics</p>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-tiny font-bold text-red-400">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Revenue Summary — admin-only platform revenue */}
        {revenue && (
          <div className="bg-card border border-border-default rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <h3 className="text-tiny font-black text-emerald-400 uppercase tracking-[0.2em]">Platform Revenue</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-glass rounded-xl p-3">
                <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Total Collected</p>
                <p className="text-lg font-black text-text-primary">${revenue.totalCollected.toFixed(2)}</p>
              </div>
              <div className="bg-glass rounded-xl p-3">
                <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Platform Fees ({revenue.platformFeePercent}%)</p>
                <p className="text-lg font-black text-emerald-400">${revenue.totalFees.toFixed(2)}</p>
              </div>
              <div className="bg-glass rounded-xl p-3">
                <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Transferred to Parties</p>
                <p className="text-lg font-black text-brand-accent">${revenue.totalToParties.toFixed(2)}</p>
              </div>
              <div className="bg-glass rounded-xl p-3">
                <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Total Contributions</p>
                <p className="text-lg font-black text-text-primary">${revenue.totalContributions.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Platform Stats — admin-only user/party/contribution counts */}
        {stats && (
          <div className="bg-card border border-border-default rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-accent" />
              <h3 className="text-tiny font-black text-brand-accent uppercase tracking-[0.2em]">Platform Stats</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-glass rounded-xl p-3 text-center">
                <Users size={16} className="text-text-faint mx-auto mb-1" />
                <p className="text-lg font-black text-text-primary">{stats.totalUsers}</p>
                <p className="text-2xs font-bold text-text-faint uppercase tracking-wider mt-0.5">Users</p>
              </div>
              <div className="bg-glass rounded-xl p-3 text-center">
                <PartyPopper size={16} className="text-text-faint mx-auto mb-1" />
                <p className="text-lg font-black text-text-primary">{stats.totalParties}</p>
                <p className="text-2xs font-bold text-text-faint uppercase tracking-wider mt-0.5">Parties</p>
              </div>
              <div className="bg-glass rounded-xl p-3 text-center">
                <CreditCard size={16} className="text-text-faint mx-auto mb-1" />
                <p className="text-lg font-black text-text-primary">{stats.totalContributions}</p>
                <p className="text-2xs font-bold text-text-faint uppercase tracking-wider mt-0.5">Contributions</p>
              </div>
            </div>
          </div>
        )}

        {/* Test Push Notification — admin-only tool */}
        <div className="bg-card border border-border-default rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={16} className="text-brand-accent" />
            <h3 className="text-tiny font-black text-brand-accent uppercase tracking-[0.2em]">Test Push Notification</h3>
          </div>
          <TestPushButton />
        </div>
      </div>
    </div>
  );
}

// ─── Test Push Button (admin-only) ──────────────────────────────────────
function TestPushButton() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const triggerBrowserNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.png" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(perm => {
        if (perm === "granted") {
          new Notification(title, { body, icon: "/icon.png" });
        }
      });
    }
  };

  const handleTest = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    setMessage('');

    // Always show a browser notification as fallback (works on web & native)
    triggerBrowserNotification('🔔 WaterParty Test', 'Push notifications are working! 🎉');

    try {
      const res = await fetchWithAuth(`${API_BASE}/api/push/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔔 WaterParty Test',
          body: 'Push notifications are working! 🎉',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('sent');
        setMessage(data.message || 'Test push sent!');
        setTimeout(() => setStatus('idle'), 4000);
      } else {
        setStatus('error');
        setMessage(data.error || `HTTP ${res.status}`);
        setTimeout(() => setStatus('idle'), 4000);
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Network error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <div>
      <button
        onClick={handleTest}
        disabled={status === 'sending'}
        className="w-full py-3 bg-brand-accent/10 border border-brand-accent/20 rounded-xl text-nano font-black uppercase tracking-widest hover:bg-brand-accent/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-brand-accent"
      >
        {status === 'sending' ? (
          <>
            <Loader size={14} className="animate-spin" />
            SENDING...
          </>
        ) : status === 'sent' ? (
          <>
            <span className="text-green-400">✓</span>
            TEST PUSH SENT
          </>
        ) : (
          <>
            <Bell size={14} />
            SEND TEST PUSH
          </>
        )}
      </button>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'text-micro font-bold uppercase tracking-widest text-center mt-1.5',
            status === 'sent' ? 'text-green-400' : 'text-red-400',
          )}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
