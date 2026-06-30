import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { Button, Spinner, showToast } from "@/components/ui";
import { loadLiveCountries, initiateCheckout, pollPaymentStatus } from "@/lib/ashtech";
import type { LiveCountry, Product } from "@/types";

type Step = "loading" | "form" | "otp" | "waiting" | "wave" | "success" | "failed";

export default function Checkout() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const discountCode = (location.state as { discountCode?: string })?.discountCode || null;

  const [product, setProduct] = useState<Product | null>(null);
  const [countries, setCountries] = useState<LiveCountry[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [waveUrl, setWaveUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [submitting, setSubmitting] = useState(false);
  const stopPollRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { if (stopPollRef.current) stopPollRef.current(); };
  }, []);

  useEffect(() => {
    if (!productId) return;

    Promise.all([
      sb.from("products").select("*").eq("id", productId).maybeSingle(),
      loadLiveCountries(),
    ]).then(([{ data: p }, cs]) => {
      setProduct(p as Product);
      setCountries(cs);
      if (cs.length) setCountryCode(cs[0].code);
      setStep("form");
    });
  }, [productId]);

  const selectedCountry = countries.find((c) => c.code === countryCode);
  const operators = selectedCountry?.operators || [];

  useEffect(() => {
    if (operators.length && !operators.includes(operator)) setOperator(operators[0]);
  }, [countryCode, operators]);

  async function submit(otpValue?: string) {
    if (!product || !phone || !operator || !countryCode) {
      showToast("Fill in your phone number", "error");
      return;
    }
    setSubmitting(true);
    const { status, data } = await initiateCheckout({
      product_id: product.id, discount_code: discountCode,
      phone, operator, country_code: countryCode, currency: selectedCountry?.currency,
      otp: otpValue, reference,
    });
    setSubmitting(false);
    setReference(data.reference);

    if (status === 202 && data.flow === "wave") {
      setWaveUrl(data.wave_url || null);
      setStep("wave");
      startPolling(data.reference);
    } else if (status === 202) {
      setStep("waiting");
      startPolling(data.reference);
    } else if (status === 400 && data.error === "otp_required") {
      setUssdCode(data.ussd_code || null);
      setStep("otp");
    } else {
      showToast(data.message || "Payment could not be started", "error");
    }
  }

  function startPolling(ref: string) {
    stopPollRef.current = pollPaymentStatus(ref, (result) => {
      if (result.status === "success") {
        setStep("success");
        setTimeout(() => navigate("/buyer/orders"), 1500);
      } else if (result.status === "failed") {
        setStep("failed");
      }
    });
  }

  if (step === "loading" || !product) {
    return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;
  }

  return (
    <div className="p-4 pb-28">
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-semibold mb-4">← Back</button>
      <div className="bg-slate-50 rounded-2xl p-4 mb-5">
        <p className="text-xs text-slate-500 mb-1">Paying for</p>
        <p className="font-bold text-slate-900">{product.title}</p>
        <p className="text-blue-600 font-extrabold text-lg">{product.price.toLocaleString()}</p>
      </div>

      {step === "form" && (
        <>
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
          <Button fullWidth disabled={submitting} onClick={() => submit()}>
            {submitting ? "Processing…" : `Pay ${product.price.toLocaleString()}`}
          </Button>
        </>
      )}

      {step === "otp" && (
        <>
          <p className="text-sm text-slate-600 mb-3">
            {ussdCode ? <>Dial <strong>{ussdCode}</strong> on your phone to get your code.</> : "Enter the OTP code you received by SMS."}
          </p>
          <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="123456"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm mb-4" />
          <Button fullWidth disabled={submitting} onClick={() => submit(otp)}>{submitting ? "Confirming…" : "Confirm"}</Button>
        </>
      )}

      {step === "waiting" && (
        <div className="text-center py-10">
          <Spinner className="text-blue-600 mx-auto mb-4" />
          <p className="font-bold text-slate-900 mb-1">Check your phone</p>
          <p className="text-sm text-slate-500">Approve the Mobile Money prompt sent to your phone.</p>
        </div>
      )}

      {step === "wave" && waveUrl && (
        <div className="text-center py-10">
          <p className="font-bold text-slate-900 mb-4">Pay with Wave</p>
          <Button fullWidth onClick={() => window.open(waveUrl, "_blank")}>Open Wave</Button>
        </div>
      )}

      {step === "success" && (
        <div className="text-center py-10">
          <p className="text-emerald-600 font-extrabold text-lg mb-1">Payment confirmed! 🎉</p>
          <p className="text-sm text-slate-500">Redirecting…</p>
        </div>
      )}

      {step === "failed" && (
        <div className="text-center py-10">
          <p className="text-red-600 font-extrabold text-lg mb-2">Payment failed</p>
          <Button fullWidth onClick={() => { setStep("form"); setReference(null); }}>Try again</Button>
        </div>
      )}
    </div>
  );
}
