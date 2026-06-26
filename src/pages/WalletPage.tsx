import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, Wallet as WalletIcon, TrendingUp, Gift, CreditCard, ArrowUpRight, ArrowDownLeft, Loader } from "lucide-react";
import { useStore } from "../lib/Store";
import { API_BASE } from "../lib/constants";

interface BalanceData {
  availableBalance: number;
  totalReceived: number;
  totalWithdrawn: number;
  tipsReceived: number;
  crowdfundEarned: number;
}

interface TipTransaction {
  id: string;
  amount: number;
  direction: "sent" | "received";
  otherUserId: string;
  otherName: string;
  otherThumbnail: string;
  createdAt: string;
}

export function WalletPage() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [tips, setTips] = useState<{ sent: TipTransaction[]; received: TipTransaction[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [balRes, tipsRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/${user.ID}/balance`),
          fetch(`${API_BASE}/api/tips/history`),
        ]);

        if (balRes.ok) setBalance(await balRes.json());
        else setError("Failed to load balance");

        if (tipsRes.ok) setTips(await tipsRes.json());
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.ID]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-overlay">
        <header className="px-4 py-4 flex items-center gap-3 border-b border-border-default bg-card shrink-0">
          <button onClick={() => navigate("/profile")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-glass text-text-muted active:scale-95 transition-all">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-sm font-black text-text-primary uppercase tracking-widest">Wallet</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader size={24} className="animate-spin text-emerald-400" />
            <p className="text-tiny font-bold text-text-faint uppercase tracking-widest animate-pulse">Loading wallet...</p>
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
          <h1 className="text-sm font-black text-text-primary uppercase tracking-widest">Wallet</h1>
          <p className="text-nano font-bold text-text-faint uppercase tracking-wider">Your Earnings</p>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-tiny font-bold text-red-400">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4 mt-4">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <WalletIcon size={18} className="text-emerald-400" />
            <span className="text-tiny font-black text-emerald-400 uppercase tracking-[0.2em]">Available Balance</span>
          </div>
          <p className="text-4xl font-black text-text-primary mb-1">
            ${(balance?.availableBalance || 0).toFixed(2)}
          </p>
          <p className="text-nano font-bold text-emerald-400/60 uppercase tracking-wider">
            Ready to withdraw
          </p>
        </div>

        {/* Earnings Breakdown */}
        <div className="bg-card border border-border-default rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className="text-tiny font-black text-emerald-400 uppercase tracking-[0.2em]">Earnings</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-glass rounded-xl p-3">
              <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Total Received</p>
              <p className="text-lg font-black text-text-primary">${(balance?.totalReceived || 0).toFixed(2)}</p>
            </div>
            <div className="bg-glass rounded-xl p-3">
              <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Withdrawn</p>
              <p className="text-lg font-black text-text-muted">${(balance?.totalWithdrawn || 0).toFixed(2)}</p>
            </div>
            <div className="bg-glass rounded-xl p-3">
              <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Tips Received</p>
              <p className="text-lg font-black text-brand-accent">${(balance?.tipsReceived || 0).toFixed(2)}</p>
            </div>
            <div className="bg-glass rounded-xl p-3">
              <p className="text-micro font-black text-text-faint uppercase tracking-wider mb-1">Party Earnings</p>
              <p className="text-lg font-black text-emerald-400">${(balance?.crowdfundEarned || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Tip History Toggle */}
        {tips && (tips.sent.length > 0 || tips.received.length > 0) && (
          <div className="bg-card border border-border-default rounded-2xl p-4 space-y-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Gift size={16} className="text-amber-400" />
                <h3 className="text-tiny font-black text-amber-400 uppercase tracking-[0.2em]">Tip History</h3>
              </div>
              <ChevronDown size={14} className={`text-text-faint transition-transform ${showHistory ? "" : "-rotate-90"}`} />
            </button>

            {showHistory && (
              <div className="space-y-2">
                {tips.received.map((tip) => (
                  <div key={tip.id} className="flex items-center gap-3 bg-glass rounded-xl p-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <ArrowDownLeft size={14} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-tiny font-bold text-text-primary truncate">{tip.otherName || "Someone"}</p>
                      <p className="text-micro font-bold text-text-faint uppercase tracking-wider">
                        {new Date(tip.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-400">+${tip.amount.toFixed(2)}</p>
                  </div>
                ))}
                {tips.sent.map((tip) => (
                  <div key={tip.id} className="flex items-center gap-3 bg-glass rounded-xl p-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                      <ArrowUpRight size={14} className="text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-tiny font-bold text-text-primary truncate">{tip.otherName || "Someone"}</p>
                      <p className="text-micro font-bold text-text-faint uppercase tracking-wider">
                        {new Date(tip.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-black text-rose-400">-${tip.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No activity state */}
        {(!tips || (tips.sent.length === 0 && tips.received.length === 0)) && (
          <div className="bg-card border border-border-default rounded-2xl p-6 text-center">
            <CreditCard size={24} className="text-text-faint mx-auto mb-3" />
            <p className="text-tiny font-black text-text-faint uppercase tracking-widest">No transactions yet</p>
            <p className="text-micro font-bold text-text-faint uppercase tracking-wider mt-1">
              Tips and party earnings will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
