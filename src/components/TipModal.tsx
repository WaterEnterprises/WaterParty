import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Loader, Check, Wallet, CreditCard, Trash2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { API_BASE, fetchWithAuth, getAssetUrl } from "../lib/constants";
import { cn } from "../lib/utils";
import { useStore } from "../lib/Store";

interface TipModalProps {
  open: boolean;
  onClose: () => void;
  receiverId: string;
  receiverName: string;
  receiverThumbnail?: string;
  onSuccess?: (amount: number) => void;
}

type TipStep = "amount" | "payment" | "processing" | "success" | "error";

const PRESET_AMOUNTS = [5, 10, 20, 50];

interface SavedMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#10B981",
    colorBackground: "#1a1b2e",
    colorText: "#ffffff",
    colorDanger: "#EF4444",
    fontFamily: "system-ui, sans-serif",
    borderRadius: "12px",
  },
};

function PaymentForm({
  clientSecret,
  amount,
  receiverId,
  saveMethod,
  setSaveMethod,
  onSuccess,
  onError,
  currencySymbol,
}: {
  clientSecret: string;
  amount: number;
  receiverId: string;
  saveMethod: boolean;
  setSaveMethod: (v: boolean) => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
  currencySymbol: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Payment failed");
      setProcessing(false);
      onError(error.message || "Payment failed");
      return;
    }

    if (paymentIntent.status === "succeeded") {
      try {
        const recordRes = await fetchWithAuth(`${API_BASE}/api/tips/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            receiverId,
            amount,
            savePaymentMethod: saveMethod,
            paymentMethodId: paymentIntent.payment_method,
          }),
        });

        if (!recordRes.ok) {
          const err = await recordRes.json();
          throw new Error(err.error || "Failed to record tip");
        }

        onSuccess();
      } catch (err: any) {
        setMessage(err.message);
        setProcessing(false);
        onError(err.message);
      }
    } else {
      setMessage("Payment did not complete");
      setProcessing(false);
      onError("Payment did not complete");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={saveMethod}
          onChange={(e) => setSaveMethod(e.target.checked)}
          className="w-3 h-3 rounded border-border-strong bg-glass accent-emerald-500"
        />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
          Save card for future payments
        </span>
      </label>
      {message && (
        <p className="text-tiny font-bold text-red-400 text-center">{message}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className={cn(
          "w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
          stripe && elements && !processing
            ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-text-primary shadow-lg shadow-emerald-500/20 active:scale-95"
            : "bg-glass text-text-faint cursor-not-allowed",
        )}
      >
        {processing ? (
          <Loader size={16} className="animate-spin" />
        ) : (
          <Send size={16} className="-rotate-45" />
        )}
        {processing ? "Processing..." : `Pay ${currencySymbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`}
      </button>
      <p className="text-2xs text-text-faint text-center uppercase tracking-widest font-bold">
        Secured by Stripe
      </p>
    </form>
  );
}

export function TipModal({
  open, onClose, receiverId, receiverName, receiverThumbnail, onSuccess,
}: TipModalProps) {
  const { userCurrency } = useStore();
  const [step, setStep] = useState<TipStep>("amount");
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [currency, setCurrency] = useState(userCurrency);

  // Sync currency with store value when it becomes available
  useEffect(() => {
    setCurrency(userCurrency);
  }, [userCurrency]);
  const [saveMethod, setSaveMethod] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [savedMethodsLoading, setSavedMethodsLoading] = useState(false);

  const currencySymbol = (c?: string) => {
    switch ((c || currency).toUpperCase()) {
      case "BRL": return "R$";
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      default: return "$";
    }
  };
  const sym = currencySymbol(currency);

  // Stripe payment flow state
  const [paymentFlow, setPaymentFlow] = useState<{
    clientSecret: string;
    publishableKey: string;
    stripePromise: any;
  } | null>(null);

  const [payWithSaved, setPayWithSaved] = useState<{
    method: SavedMethod;
    clientSecret: string;
    stripePromise: any;
  } | null>(null);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("amount");
        setAmount(10);
        setCustomAmount("");
        setErrorMessage(null);
        setMessage("");
        setPaymentFlow(null);
        setPayWithSaved(null);
        setSaveMethod(false);
        setCurrency(userCurrency);
      }, 300);
    }
  }, [open]);

  // Fetch saved payment methods when modal opens
  useEffect(() => {
    if (open) {
      setSavedMethodsLoading(true);
      fetchWithAuth(`${API_BASE}/api/saved-payment-methods`)
        .then(res => res.ok ? res.json() : { paymentMethods: [] })
        .then(data => setSavedMethods(data.paymentMethods || []))
        .catch(() => {})
        .finally(() => setSavedMethodsLoading(false));
    }
  }, [open]);

  const handleSend = useCallback(async (useSavedMethod?: SavedMethod) => {
    const finalAmount = customAmount ? Number(customAmount) : amount;
    if (finalAmount < 1 || finalAmount > 10000) {
      const sym = currencySymbol(currency);
      setErrorMessage(`Amount must be between ${sym}1 and ${sym}10,000`);
      return;
    }

    setStep("processing");
    setErrorMessage(null);

    try {
      // Create payment intent
      const piRes = await fetchWithAuth(`${API_BASE}/api/tips/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount, receiverId, currency }),
      });

      if (!piRes.ok) {
        const errData = await piRes.json();
        throw new Error(errData.error || "Failed to create payment");
      }

      const piData = await piRes.json();

      // Load Stripe
      const stripe = await loadStripe(piData.publishableKey);
      if (!stripe) throw new Error("Failed to load Stripe");

      if (useSavedMethod) {
        // Pay immediately with saved card
        const { error, paymentIntent } = await stripe.confirmCardPayment(piData.clientSecret, {
          payment_method: useSavedMethod.id,
        });

        if (error) {
          throw new Error(error.message || "Payment failed");
        }

        if (paymentIntent.status === "succeeded") {
          const recordRes = await fetchWithAuth(`${API_BASE}/api/tips/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              receiverId,
              amount: finalAmount,
            }),
          });

          if (!recordRes.ok) {
            const err = await recordRes.json();
            throw new Error(err.error || "Failed to record tip");
          }

          setStep("success");
          onSuccess?.(finalAmount);
        } else {
          throw new Error("Payment did not complete");
        }
      } else {
        // Show PaymentElement form for card entry
        setPaymentFlow({
          clientSecret: piData.clientSecret,
          publishableKey: piData.publishableKey,
          stripePromise: stripe,
        });
        setStep("payment");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Something went wrong");
      setStep("error");
    }
  }, [amount, customAmount, receiverId, currency, onSuccess]);

  const handleDeleteSavedMethod = async (methodId: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/detach-payment-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: methodId }),
      });
      if (res.ok) {
        setSavedMethods(prev => prev.filter(m => m.id !== methodId));
      }
    } catch {}
  };

  const handlePaymentSuccess = () => {
    setStep("success");
    const finalAmount = customAmount ? Number(customAmount) : amount;
    onSuccess?.(finalAmount);
  };

  const handlePaymentError = (msg: string) => {
    setErrorMessage(msg);
    setStep("error");
  };

  const handlePresetClick = (val: number) => {
    setAmount(val);
    setCustomAmount("");
    setErrorMessage(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setCustomAmount(val);
      if (val) setAmount(0);
      setErrorMessage(null);
    }
  };

  const getDisplayAmount = () => customAmount || String(amount);
  const displaySym = sym;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="w-full max-w-sm bg-card border border-border-default rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border-default flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Wallet size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Send Money</h3>
                  <p className="text-micro font-bold text-text-faint uppercase tracking-wider">Peer-to-peer transfer</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-glass flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* Receiver info */}
              <div className="flex items-center gap-3 mb-5 bg-glass rounded-2xl p-3">
                <img
                  src={getAssetUrl(receiverThumbnail || "")}
                  className="w-12 h-12 rounded-full object-cover border border-border-default"
                  alt={receiverName}
                />
                <div>
                  <p className="text-sm font-bold text-text-primary">{receiverName}</p>
                  <p className="text-micro font-black text-text-faint uppercase tracking-widest">Receiving</p>
                </div>
                <div className="ml-auto">
                  <Send size={16} className="text-emerald-400 -rotate-45" />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {step === "amount" && (
                  <motion.div
                    key="amount"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Currency selector */}
                    <div className="flex gap-1.5">
                      {["USD", "BRL", "EUR", "GBP"].map((c) => (
                        <button
                          key={c}
                          onClick={() => { setCurrency(c); setErrorMessage(null); }}
                          className={`flex-1 py-2 rounded-xl text-micro font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 ${
                            currency === c
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10"
                              : "bg-glass border-border-default text-text-secondary hover:text-text-primary hover:bg-glass-hover"
                          }`}
                        >
                          <span className="text-base">
                            {c === "USD" ? "🇺🇸" : c === "BRL" ? "🇧🇷" : c === "EUR" ? "🇪🇺" : "🇬🇧"}
                          </span>
                          <span>{c}</span>
                        </button>
                      ))}
                    </div>

                    {/* Preset amounts */}
                    <div className="grid grid-cols-4 gap-2">
                      {PRESET_AMOUNTS.map((val) => (
                        <button
                          key={val}
                          onClick={() => handlePresetClick(val)}
                          className={`py-3 rounded-xl text-sm font-black tracking-wider transition-all active:scale-95 ${
                            amount === val && !customAmount
                              ? "bg-emerald-500 text-text-primary shadow-lg shadow-emerald-500/20"
                              : "bg-glass border border-border-default text-text-secondary hover:bg-glass-hover"
                          }`}
                        >
                          {sym}{val}
                        </button>
                      ))}
                    </div>

                    {/* Custom amount */}
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-text-faint">{sym}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Custom amount"
                        value={customAmount}
                        onChange={handleCustomChange}
                        className="w-full bg-glass border border-border-default rounded-xl pl-8 pr-4 py-3 text-sm font-bold text-text-primary placeholder:text-text-faint outline-none focus:border-emerald-500/40 transition-colors"
                      />
                    </div>

                    {/* Optional note */}
                    <div>
                      <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={100}
                        className="w-full bg-glass border border-border-default rounded-xl px-4 py-3 text-xs font-medium text-text-bright placeholder:text-text-faint outline-none focus:border-border-strong transition-colors"
                      />
                    </div>

                    {/* Error */}
                    {errorMessage && (
                      <p className="text-tiny font-bold text-red-400 text-center">{errorMessage}</p>
                    )}

                    {/* Send button */}
                    <button
                      onClick={() => handleSend()}
                      disabled={!getDisplayAmount() || Number(getDisplayAmount()) < 1}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-text-primary text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                    >
                      <Send size={16} className="-rotate-45" />
                      Send {sym}{getDisplayAmount()}
                    </button>
                  </motion.div>
                )}

                {step === "payment" && paymentFlow && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <p className="text-nano text-text-secondary text-center leading-relaxed">
                      Send <strong className="text-emerald-400">{displaySym}{getDisplayAmount()}</strong> to{" "}
                      <strong className="text-text-primary">{receiverName}</strong>
                    </p>

                    {/* Saved cards */}
                    {savedMethods.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-micro font-black text-text-faint uppercase tracking-widest flex items-center gap-1">
                          <CreditCard size={9} />
                          Saved cards
                        </p>
                        {savedMethods.map((method) => (
                          <div
                            key={method.id}
                            onClick={() => handleSend(method)}
                            className="flex items-center gap-2 bg-glass border border-border-default rounded-xl p-2 cursor-pointer hover:bg-glass-hover transition-all active:scale-[0.98]"
                          >
                            <div className="w-7 h-4 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-2xs font-black text-text-primary uppercase">
                              {method.brand === "visa" ? "VISA" : method.brand === "mastercard" ? "MC" : "CC"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-micro font-bold text-text-primary">
                                •••• {method.last4}
                              </p>
                              <p className="text-2xs text-text-faint font-bold uppercase tracking-wider">
                                Expires {method.expMonth}/{method.expYear}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteSavedMethod(method.id); }}
                              className="w-6 h-6 rounded-full bg-glass flex items-center justify-center text-text-faint hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-glass" />
                      <span className="text-2xs font-bold text-text-faint uppercase tracking-wider whitespace-nowrap">
                        {savedMethods.length > 0 ? "or new payment" : "payment details"}
                      </span>
                      <div className="flex-1 h-px bg-glass" />
                    </div>

                    <Elements
                      stripe={paymentFlow.stripePromise}
                      options={{ clientSecret: paymentFlow.clientSecret, appearance }}
                    >
                      <PaymentForm
                        clientSecret={paymentFlow.clientSecret}
                        amount={Number(getDisplayAmount())}
                        receiverId={receiverId}
                        saveMethod={saveMethod}
                        setSaveMethod={setSaveMethod}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        currencySymbol={displaySym}
                      />
                    </Elements>
                  </motion.div>
                )}

                {step === "processing" && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 py-8"
                  >
                    <Loader size={40} className="text-emerald-400 animate-spin" />
                    <p className="text-sm font-bold text-text-secondary">Setting up payment...</p>
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 py-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Check size={32} className="text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-text-primary">{displaySym}{getDisplayAmount()} Sent!</p>
                      <p className="text-xs text-text-muted mt-1">Money sent to {receiverName}</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="mt-2 px-8 py-3 rounded-xl bg-glass border border-border-default text-text-primary text-tiny font-black uppercase tracking-widest hover:bg-glass-hover transition-all active:scale-95"
                    >
                      Done
                    </button>
                  </motion.div>
                )}

                {step === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 py-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
                      <X size={32} className="text-red-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-red-400 uppercase tracking-widest">Payment Failed</p>
                      <p className="text-xs text-text-muted mt-1">{errorMessage || "Something went wrong"}</p>
                    </div>
                    <button
                      onClick={() => { setStep("amount"); setPaymentFlow(null); setErrorMessage(null); }}
                      className="mt-2 px-8 py-3 rounded-xl bg-glass border border-border-default text-text-primary text-tiny font-black uppercase tracking-widest hover:bg-glass-hover transition-all active:scale-95"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
