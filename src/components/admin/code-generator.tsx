"use client";

import { useState, useTransition } from "react";
import { createActivationCode } from "@/lib/actions/admin";
import { ui } from "@/components/ui";

export type AdminCodeRow = {
  id: string;
  code: string;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  note: string | null;
  createdAt: Date;
};

export function CodeGenerator({ codes }: { codes: AdminCodeRow[] }) {
  const [days, setDays] = useState("30");
  const [uses, setUses] = useState("1");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [rows, setRows] = useState(codes);

  const generate = () => {
    setError("");
    setCreated(null);
    start(async () => {
      const r = await createActivationCode(Number(days), Number(uses), note);
      if (r.ok) {
        setCreated(r.code);
        setNote("");
        setRows((prev) => [
          { id: r.code, code: r.code, durationDays: Number(days), maxUses: Number(uses), usedCount: 0, note: note || null, createdAt: new Date() },
          ...prev,
        ]);
      } else setError(r.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className={ui.label}>মেয়াদ (দিন)</label>
          <input value={days} onChange={(e) => setDays(e.target.value)} className={`${ui.input} w-24`} inputMode="numeric" />
        </div>
        <div>
          <label className={ui.label}>সর্বোচ্চ ব্যবহার</label>
          <input value={uses} onChange={(e) => setUses(e.target.value)} className={`${ui.input} w-24`} inputMode="numeric" />
        </div>
        <div className="min-w-40 flex-1">
          <label className={ui.label}>নোট (ঐচ্ছিক)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: ফেসবুক প্রোমো" className={ui.input} />
        </div>
        <button disabled={pending} onClick={generate} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "তৈরি হচ্ছে…" : "+ কোড তৈরি করুন"}
        </button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      {created && (
        <p className="rounded-lg border border-success/40 bg-success/10 p-2 text-sm">
          ✓ কোড তৈরি হয়েছে: <b className="select-all font-mono">{created}</b>
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 font-medium">কোড</th>
              <th className="pb-2 font-medium">মেয়াদ</th>
              <th className="pb-2 font-medium">ব্যবহার</th>
              <th className="pb-2 font-medium">নোট</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2 pr-2 font-mono">{c.code}</td>
                <td className="py-2 pr-2 text-xs text-muted">{c.durationDays} দিন</td>
                <td className="py-2 pr-2 text-xs text-muted">
                  {c.usedCount}/{c.maxUses}
                </td>
                <td className="py-2 pr-2 text-xs text-muted">{c.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-2 text-sm text-muted">এখনো কোনো কোড তৈরি হয়নি।</p>}
      </div>
    </div>
  );
}
