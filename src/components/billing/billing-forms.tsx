"use client";

import { useState, useTransition } from "react";
import { redeemActivationCode, submitBkashPayment } from "@/lib/actions/billing";
import { BILLING_PLANS, BKASH_RECEIVE_NUMBER } from "@/lib/billing-config";
import { ui } from "@/components/ui";

export function BkashPaymentForm() {
  const [planCode, setPlanCode] = useState<string>(BILLING_PLANS[0].code);
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const submit = () => {
    setMsg(null);
    start(async () => {
      const r = await submitBkashPayment(planCode, sender, trx);
      if (r.ok) {
        setMsg({ type: "ok", text: "✓ জমা হয়েছে — আমরা শিগগিরই যাচাই করে প্রিমিয়াম চালু করে দেব।" });
        setSender("");
        setTrx("");
      } else setMsg({ type: "error", text: r.error });
    });
  };

  return (
    <div className={ui.card}>
      <h2 className="font-semibold">বিকাশে পেমেন্ট করুন</h2>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
        <li>
          বিকাশ <b className="text-foreground">Send Money</b>-তে যান এবং পাঠান{" "}
          <b className="select-all text-foreground">{BKASH_RECEIVE_NUMBER}</b> নাম্বারে
        </li>
        <li>নিচে থেকে প্ল্যান বাছাই করুন ও সঠিক পরিমাণ টাকা পাঠান</li>
        <li>পেমেন্টের TrxID (ট্রানজেকশন আইডি) আর আপনার বিকাশ নাম্বার নিচে দিন</li>
      </ol>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {BILLING_PLANS.map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() => setPlanCode(p.code)}
            className={`rounded-lg border px-2 py-3 text-center text-sm transition ${
              planCode === p.code ? "border-accent bg-accent/10" : "border-border hover:border-accent"
            }`}
          >
            <span className="block font-semibold">{p.label}</span>
            <span className="block text-xs text-muted">৳{p.amountBdt}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className={ui.label}>আপনার বিকাশ নাম্বার</label>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="01XXXXXXXXX"
            inputMode="numeric"
            className={ui.input}
          />
        </div>
        <div>
          <label className={ui.label}>TrxID (ট্রানজেকশন আইডি)</label>
          <input
            value={trx}
            onChange={(e) => setTrx(e.target.value)}
            placeholder="যেমন: 9N7A2B3C4D"
            className={`${ui.input} uppercase`}
          />
        </div>
        <button disabled={pending} onClick={submit} className={`${ui.btn} ${ui.primary} w-full`}>
          {pending ? "জমা হচ্ছে…" : "পেমেন্ট জমা দিন"}
        </button>
        {msg && <p className={`text-sm ${msg.type === "ok" ? "text-success" : "text-error"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

export function ActivationCodeForm() {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const submit = () => {
    setMsg(null);
    start(async () => {
      const r = await redeemActivationCode(code);
      if (r.ok) {
        setMsg({ type: "ok", text: `✓ প্রিমিয়াম সক্রিয় হয়েছে — মেয়াদ ${new Date(r.expiresAt).toLocaleDateString("bn-BD")} পর্যন্ত।` });
        setCode("");
      } else setMsg({ type: "error", text: r.error });
    });
  };

  return (
    <div className={ui.card}>
      <h2 className="font-semibold">অ্যাক্টিভেশন কোড আছে?</h2>
      <p className="mt-1 text-sm text-muted">প্রোমো বা সরাসরি কেনা কোড থাকলে এখানে দিন — সাথে সাথেই প্রিমিয়াম চালু হয়ে যাবে।</p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PLNR-XXXX-XXXX"
          className={`${ui.input} uppercase`}
        />
        <button disabled={pending || !code.trim()} onClick={submit} className={`${ui.btn} ${ui.primary} shrink-0`}>
          {pending ? "চেক হচ্ছে…" : "সক্রিয় করুন"}
        </button>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.type === "ok" ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}
