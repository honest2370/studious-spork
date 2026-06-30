import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, showToast } from "@/components/ui";
import { loadLiveCountries, initiateDeposit, pollPaymentStatus } from "@/lib/ashtech";
import type { LiveCountry } from "@/types";

type Step = "amount" | "form" | "otp" | "waiting" | "wave" | "success" | "failed";

export default function Deposit() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [countries, setCountries] = useState<LiveCountry[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [waveUrl, setWaveUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("amount");
  const [submitting, setSubmitting] = useState(false);
  const stopPollRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { if (stopPollRef.current) stopPollRef.current(); };
  }, []);

  useEffect(() => { loadLiveCountries().then((cs) => { setCountries(cs); if (cs.length) setCountryCode(cs[0].code); }); }, []);

  const selectedCountry = countries.find((c) => c.code === countryCode);
  const operators = selectedCountry?.operators || [];
  useEffect(() => { if (operators.length && !operators.includes(operator)) setOperator(operators[0]); }, [countryCode, operators]);

  function continueToForm() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 500) { showToast("Enter an amount of at least 500", "error"); return; }
    setStep("form");
  }

  async function submit(otpValue?: string) {
    if (!phone || !operator || !countryCode) { showToast("Fill in your phone number", "error"); return; }
    setSubmitting(true);
    const { status, data } = await initiateDeposit({
      amount: Number(amount), phone, operator, country_code: countryCode,
      currency: selectedCountry?.currency, otp: otpValue, reference,
    });
    setSubmitting(false);
    setReference(data.reference);

    if (status === 202 && data.flow === "wave") { setWaveUrl(data.wave_url || null); setStep("wave"); startPolling(data.reference); }
    else if (status === 202) { setStep("waiting"); startPolling(data.reference); }
    else if (status === 400 && data.error === "otp_required") { setUssdCode(data.ussd_code || null); setStep("otp"); }
    else showToast(data.message || "Payment could not be started", "error");
  }

  function startPolling(ref: string) {
    stopPollRef.current = pollPaymentStatus(ref, async (result) => {
      if (result.status === "success") {
        setStep("success");
        await refreshUser();
        setTimeout(() => navigate("/buyer/account"), 1500);
      } else if (result.status === "failed") setStep("failed");
    });
  }

  return (
    <div className="p-4 pb-28">
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-semibold mb-4">← Back</button>
      <h1 className="text-xl font-extrabold text-slate-900 mb-6">Add Funds</h1>

      {step === "amount" && (
        <>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="e.g. 5000"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm mb-4" />
          <Button fullWidth onClick={continueToForm}>Continue</Button>
        </>
      )}

      {step === "form" && (
        <>
          <p className="text-sm text-slate-500 mb-4">Depositing <strong>{Number(amount).toLocaleString()}</strong></p>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Country</label>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Operator</label>
            <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              {operators.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Phone number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="e.g. 670000000"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          </div>
          <Button fullWidth disabled={submitting} onClick={() => submit()}>{submitting ? "Processing…" : `Deposit ${Number(amount).toLocaleString()}`}</Button>
        </>
      )}

      {step === "otp" && (
        <>
          <p className="text-sm text-slate-600 mb-3">{ussdCode ? <>Dial <strong>{ussdCode}</strong> to get your code.</> : "Enter the OTP code you received by SMS."}</p>
          <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="123456"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm mb-4" />
          <Button fullWidth disabled={submitting} onClick={() => submit(otp)}>{submitting ? "Confirming…" : "Confirm"}</Button>
        </>
      )}

      {step === "waiting" && <p className="text-center text-slate-500 py-10">Check your phone to approve the payment…</p>}
      {step === "wave" && waveUrl && <Button fullWidth onClick={() => window.open(waveUrl, "_blank")}>Open Wave</Button>}
      {step === "success" && <p className="text-center text-emerald-600 font-bold py-10">Funds added! 🎉</p>}
      {step === "failed" && <Button fullWidth onClick={() => { setStep("amount"); setReference(null); }}>Try again</Button>}
    </div>
  );
}
