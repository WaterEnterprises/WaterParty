import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart, Loader2, CheckCircle, DollarSign, Users, CreditCard, Trash2, Plus } from "lucide-react";
import { API_BASE, fetchWithAuth, getAssetUrl } from "../lib/constants";
import { useStore } from "../lib/Store";
import { cn } from "../lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface FundraiserContributeModalProps {
  open: boolean;
  onClose: () => void;
  partyId: string;
  partyTitle: string;
  currentAmount: number;
  targetAmount: number;
  currency?: string;
}

interface SavedMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface Contributor {
  id: string;
  userId: string;
  amount: number;
  createdAt: string;
  userName: string;
  userThumbnail: string;
}

interface BoletoDetails {
  hosted_voucher_url: string;
  pdf: string;
  number: string;
  expires_at: number;
}

type ContributionStep = "amount" | "payment" | "boleto" | "processing" | "success" | "error";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

const currencySymbol = (c?: string) => {
  switch ((c || "USD").toUpperCase()) {
    case "BRL": return "R$";
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    default: return "$";
  }
};

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#F59E0B",
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
  partyTitle,
  partyId,
  currency,
  onSuccess,
  onError,
  onBoletoGenerated,
  saveMethod,
  setSaveMethod,
}: {
  clientSecret: string;
  amount: number;
  partyTitle: string;
  partyId: string;
  currency?: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onBoletoGenerated: (details: BoletoDetails) => void;
  saveMethod: boolean;
  setSaveMethod: (v: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sym = currencySymbol(currency);

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

    // Boleto / async payment methods return 'processing'
    if (paymentIntent.status === "processing") {
      const boleto = (paymentIntent as any).next_action?.boleto_display_details;
      if (boleto) {
        onBoletoGenerated({
          hosted_voucher_url: boleto.hosted_voucher_url,
          pdf: boleto.pdf,
          number: boleto.number,
          expires_at: boleto.expires_at,
        });
      } else {
        onError("Payment is processing but no boleto details were returned. Check your Stripe dashboard.");
      }
      setProcessing(false);
      return;
    }

    if (paymentIntent.status === "succeeded") {
      try {
        const contribRes = await fetchWithAuth(`${API_BASE}/api/crowdfund/contribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            partyId,
            amount,
            savePaymentMethod: saveMethod,
            paymentMethodId: paymentIntent.payment_method,
          }),
        });

        if (!contribRes.ok) {
          const err = await contribRes.json();
          throw new Error(err.error || "Failed to record contribution");
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
    <form onSubmit={handleSubmit} className="space-y-2">
      <PaymentElement />
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={saveMethod}
          onChange={(e) => setSaveMethod(e.target.checked)}
          className="w-3 h-3 rounded border-border-strong bg-glass accent-amber-500"
        />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
          Save card for future payments
        </span>
      </label>
      {message && (
        <p className="text-micro font-bold text-red-400 uppercase tracking-wider text-center">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className={cn(
          "w-full py-2 rounded-xl text-micro font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5",
          stripe && elements && !processing
            ? "bg-gradient-to-r from-rose-500 to-amber-500 text-text-primary shadow-lg shadow-rose-500/20 hover:from-rose-400 hover:to-amber-400 active:scale-95"
            : "bg-glass text-text-faint cursor-not-allowed",
        )}
      >
        {processing ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <DollarSign size={10} />
        )}
        {processing ? "Processing..." : `Pay ${sym}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`}
      </button>
      <p className="text-2xs text-text-faint text-center uppercase tracking-widest font-bold">
        Secured by Stripe
      </p>
    </form>
  );
}

export function FundraiserContributeModal({
  open,
  onClose,
  partyId,
  partyTitle,
  currentAmount,
  targetAmount,
  currency,
}: FundraiserContributeModalProps) {
  const { user, userCurrency } = useStore();
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [step, setStep] = useState<ContributionStep>("amount");
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saveMethod, setSaveMethod] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [savedMethodsLoading, setSavedMethodsLoading] = useState(false);

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

  const [boletoDetails, setBoletoDetails] = useState<BoletoDetails | null>(null);

  const sym = currencySymbol(currency || userCurrency);

  // Fetch contribution history when modal opens
  useEffect(() => {
    if (open && partyId) {
      const abort = new AbortController();
      setContributorsLoading(true);
      fetch(`${API_BASE}/api/crowdfund/contributions/${partyId}`, { signal: abort.signal })
        .then(res => res.ok ? res.json() : [])
        .then(data => { if (Array.isArray(data)) setContributors(data); })
        .catch(() => {})
        .finally(() => setContributorsLoading(false));
      return () => abort.abort();
    }
  }, [open, partyId]);

  // Fetch saved payment methods when modal opens
  useEffect(() => {
    if (open && user) {
      setSavedMethodsLoading(true);
      fetchWithAuth(`${API_BASE}/api/saved-payment-methods`)
        .then(res => res.ok ? res.json() : { paymentMethods: [] })
        .then(data => setSavedMethods(data.paymentMethods || []))
        .catch(() => {})
        .finally(() => setSavedMethodsLoading(false));
    }
  }, [open, user]);

  const getAmount = () => {
    if (selectedAmount) return selectedAmount;
    const parsed = parseFloat(customAmount);
    return isNaN(parsed) ? 0 : parsed;
  };

  const amount = getAmount();
  const canContribute = amount >= 1;

  const handlePresetClick = (val: number) => {
    setSelectedAmount(val);
    setCustomAmount("");
    setErrorMessage(null);
  };

  const handleCustomChange = (val: string) => {
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setCustomAmount(val);
      setSelectedAmount(null);
      setErrorMessage(null);
    }
  };

  const handleStartPayment = async (useSavedMethod?: SavedMethod) => {
    if (!canContribute || !user) return;

    setProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetchWithAuth(`${API_BASE}/api/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, partyId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment setup failed");
      }

      const { clientSecret, publishableKey: pk } = await res.json();
      const stripe = await loadStripe(pk);
      if (!stripe) throw new Error("Failed to load Stripe");

      if (useSavedMethod) {
        // Pay immediately with saved method
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: useSavedMethod.id,
        });

        if (error) {
          throw new Error(error.message || "Payment failed");
        }

        if (paymentIntent.status === "succeeded") {
          const contribRes = await fetchWithAuth(`${API_BASE}/api/crowdfund/contribute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              partyId,
              amount,
            }),
          });

          if (!contribRes.ok) {
            const err = await contribRes.json();
            throw new Error(err.error || "Failed to record contribution");
          }

          setStep("success");
          setTimeout(() => {
            handleCloseAfterSuccess();
          }, 3000);
        } else {
          throw new Error("Payment did not complete");
        }
      } else {
        // Show PaymentElement form
        setPaymentFlow({ clientSecret, publishableKey: pk, stripePromise: stripe });
        setStep("payment");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong");
      setStep("error");
    } finally {
      setProcessing(false);
    }
  };

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
    setTimeout(() => {
      handleCloseAfterSuccess();
    }, 3000);
  };

  const handlePaymentError = (msg: string) => {
    setErrorMessage(msg);
    setStep("error");
  };

  const handleBoletoGenerated = (details: BoletoDetails) => {
    setBoletoDetails(details);
    setStep("boleto");
  };

  const handleCloseAfterSuccess = () => {
    onClose();
    setTimeout(() => {
      setStep("amount");
      setCustomAmount("");
      setSelectedAmount(null);
      setErrorMessage(null);
      setPaymentFlow(null);
      setPayWithSaved(null);
      setSaveMethod(false);
      setBoletoDetails(null);
    }, 300);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep("amount");
      setCustomAmount("");
      setSelectedAmount(null);
      setErrorMessage(null);
      setPaymentFlow(null);
      setPayWithSaved(null);
      setSaveMethod(false);
      setBoletoDetails(null);
    }, 300);
  };

  const percentRaised = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 260 }}
            className="w-full max-w-md bg-overlay border border-border-default rounded-3xl flex flex-col max-h-[90vh] shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-4 pt-3 pb-2 border-b border-border-default">
              <button
                onClick={handleClose}
                className="absolute top-3 right-4 w-6 h-6 rounded-full bg-glass flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-glass-hover transition-all"
              >
                <X size={12} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
                  <Heart size={14} className="text-text-primary" />
                </div>
                <div>
                  <h3 className="text-nano font-bold text-text-primary uppercase tracking-widest">
                    Fundraiser
                  </h3>
                  <p className="text-2xs text-text-muted font-bold uppercase tracking-wider">
                    Support the vibe
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-micro font-black text-text-muted uppercase tracking-wider">
                    Raised
                  </span>
                  <span className="text-micro font-bold text-text-primary">
                    {sym}{currentAmount.toFixed(0)} / {sym}{targetAmount.toFixed(0)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-glass overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-700 ease-out"
                    style={{ width: `${percentRaised}%` }}
                  />
                </div>
              </div>

              {/* Contributor History */}
              <div className="max-h-[160px] overflow-y-auto space-y-1 scrollbar-hide">
                <div className="flex items-center gap-1.5">
                  <Users size={10} className="text-text-faint" />
                  <span className="text-micro font-black text-text-faint uppercase tracking-widest">
                    {contributorsLoading ? "Loading..." : `${contributors.length} contributor${contributors.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {!contributorsLoading && contributors.length === 0 && (
                  <p className="text-micro text-text-faint italic text-center py-1">
                    No contributions yet. Be the first!
                  </p>
                )}
                {contributors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 bg-glass rounded-xl p-2"
                  >
                    <img
                      src={getAssetUrl(c.userThumbnail)}
                      alt={c.userName}
                      className="w-6 h-6 rounded-full object-cover border border-border-default shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-micro font-bold text-text-primary truncate">
                        {c.userName}
                      </p>
                      <p className="text-2xs text-text-faint font-bold uppercase tracking-wider">
                        {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-micro font-bold text-amber-400 shrink-0">
                      +{sym}{c.amount.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              {step === "amount" && (
                <>
                  <p className="text-micro text-text-secondary leading-relaxed">
                    Contribute to <strong className="text-text-primary">{partyTitle}</strong> and help make this party unforgettable.
                  </p>

                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_AMOUNTS.map((val) => (
                      <button
                        key={val}
                        onClick={() => handlePresetClick(val)}
                        className={cn(
                          "py-2 rounded-xl text-micro font-bold uppercase tracking-wider transition-all border",
                          selectedAmount === val
                            ? "bg-brand-accent/20 border-brand-accent text-brand-accent shadow-lg shadow-brand-accent/10"
                            : "bg-glass border-border-default text-text-secondary hover:text-text-primary hover:bg-glass-hover",
                        )}
                      >
                        {sym}{val}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Custom amount"
                      value={customAmount}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      className="w-full bg-glass border border-border-default rounded-xl py-2 pl-8 pr-3 text-tiny font-bold text-text-primary placeholder:text-text-faint outline-none focus:border-brand-accent/50 transition-colors"
                    />
                  </div>

                  {errorMessage && (
                    <p className="text-micro font-bold text-red-400 uppercase tracking-wider">
                      {errorMessage}
                    </p>
                  )}

                  <button
                    onClick={() => handleStartPayment()}
                    disabled={!canContribute}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-micro font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5",
                      canContribute
                        ? "bg-gradient-to-r from-rose-500 to-amber-500 text-text-primary shadow-lg shadow-rose-500/20 hover:from-rose-400 hover:to-amber-400 active:scale-95"
                        : "bg-glass text-text-faint cursor-not-allowed",
                    )}
                  >
                    {processing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Heart size={10} />
                    )}
                    {processing ? "Setting up..." : `Contribute ${sym}${amount > 0 ? amount.toFixed(amount % 1 === 0 ? 0 : 2) : "0"}`}
                  </button>
                </>
              )}

              {step === "payment" && paymentFlow && (
                <div className="space-y-2">
                  <p className="text-micro text-text-secondary leading-relaxed text-center">
                    Contribute <strong className="text-text-primary">{sym}{amount.toFixed(amount % 1 === 0 ? 0 : 2)}</strong> to{" "}
                    <strong className="text-text-primary">{partyTitle}</strong>
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
                          className="flex items-center gap-2 bg-glass border border-border-default rounded-xl p-2"
                        >
                          <div className="w-7 h-4 rounded bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-2xs font-black text-text-primary uppercase">
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
                            onClick={() => handleDeleteSavedMethod(method.id)}
                            className="w-6 h-6 rounded-full bg-glass flex items-center justify-center text-text-faint hover:text-red-400 hover:bg-red-500/10 transition-all"
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

                  {/* Payment Element */}
                  <Elements
                    stripe={paymentFlow.stripePromise}
                    options={{ clientSecret: paymentFlow.clientSecret, appearance }}
                  >
                    <PaymentForm
                      clientSecret={paymentFlow.clientSecret}
                      amount={amount}
                      partyTitle={partyTitle}
                      partyId={partyId}
                      currency={currency}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onBoletoGenerated={handleBoletoGenerated}
                      saveMethod={saveMethod}
                      setSaveMethod={setSaveMethod}
                    />
                  </Elements>
                </div>
              )}

              {step === "boleto" && boletoDetails && (
                <div className="py-4 flex flex-col items-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <CreditCard size={16} />
                  </div>
                  <h3 className="text-tiny font-black text-text-primary uppercase tracking-widest">
                    Boleto Generated
                  </h3>
                  <p className="text-micro text-text-secondary max-w-[260px] leading-relaxed">
                    Pay the boleto within 3 business days to confirm your{" "}
                    <strong className="text-brand-accent">{sym}{amount.toFixed(0)}</strong> contribution.
                    Your contribution will appear automatically once paid.
                  </p>
                  <div className="w-full bg-glass rounded-xl p-2.5 space-y-1">
                    <p className="text-2xs text-text-faint font-bold uppercase tracking-wider">Boleto number</p>
                    <p className="text-nano font-mono font-bold text-text-primary break-all">{boletoDetails.number}</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <a
                      href={boletoDetails.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-amber-500 text-overlay text-micro font-black uppercase tracking-widest text-center hover:bg-amber-400 transition-all active:scale-95"
                    >
                      Download PDF
                    </a>
                    <a
                      href={boletoDetails.hosted_voucher_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-glass border border-border-default text-text-primary text-micro font-black uppercase tracking-widest text-center hover:bg-glass-hover transition-all active:scale-95"
                    >
                      View Online
                    </a>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-micro font-bold text-text-muted hover:text-text-primary transition-colors uppercase tracking-wider"
                  >
                    Close
                  </button>
                </div>
              )}

              {step === "success" && (
                <div className="py-6 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle size={22} />
                  </div>
                  <h3 className="text-xs font-black text-text-primary uppercase tracking-widest">
                    Payment Successful!
                  </h3>
                  <p className="text-nano text-text-secondary max-w-[260px]">
                    You contributed <strong className="text-brand-accent">{sym}{amount.toFixed(0)}</strong> to{" "}
                    <strong className="text-text-primary">{partyTitle}</strong>. Thank you for supporting the community!
                  </p>
                  <p className="text-micro text-text-faint uppercase tracking-wider">
                    Closing automatically...
                  </p>
                </div>
              )}

              {step === "error" && (
                <div className="py-5 flex flex-col items-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30">
                    <X size={16} />
                  </div>
                  <h3 className="text-tiny font-black text-text-primary uppercase tracking-widest">
                    Payment Failed
                  </h3>
                  <p className="text-micro text-text-secondary max-w-[260px]">
                    {errorMessage || "Something went wrong. Please try again."}
                  </p>
                  <button
                    onClick={() => {
                      setStep("amount");
                      setErrorMessage(null);
                      setPaymentFlow(null);
                    }}
                    className="px-6 py-2 bg-glass border border-border-default rounded-xl text-micro font-bold text-text-primary hover:bg-glass-hover transition-all active:scale-95"
                  >
                    TRY AGAIN
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
