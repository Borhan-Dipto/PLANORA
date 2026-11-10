"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoGeneratePlan } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

export function AutoPlannerForm() {
  const router = useRouter();
  const [f, setF] = useState({ goal: "", subjects: "", examDate: "", hours: 3, notes: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await autoGeneratePlan({
        goal: f.goal,
        subjects: f.subjects,
        examDate: f.examDate,
        dailyStudyMinutes: Math.round(f.hours * 60),
        notes: f.notes,
      });
      if (!res.ok) return setError(res.error);
      router.push(`/planner/${res.id}`);
    });
  };

  return (
    <form onSubmit={submit} className={`${ui.card} space-y-4`}>
      <div>
        <label className={ui.label}>কীসের জন্য পড়ছেন?</label>
        <input
          className={ui.input}
          value={f.goal}
          maxLength={300}
          placeholder="যেমন: HSC 2027, বিজ্ঞান বিভাগ"
          onChange={(e) => setF({ ...f, goal: e.target.value })}
        />
      </div>
      <div>
        <label className={ui.label}>বিষয়সমূহ *</label>
        <textarea
          className={`${ui.input} min-h-24`}
          value={f.subjects}
          maxLength={1500}
          required
          placeholder="কমা বা লাইন দিয়ে আলাদা করুন: পদার্থবিজ্ঞান, রসায়ন, উচ্চতর গণিত"
          onChange={(e) => setF({ ...f, subjects: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ui.label}>দৈনিক পড়ার সময় (ঘণ্টা) *</label>
          <input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={12}
            step={0.5}
            className={ui.input}
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={ui.label}>পরীক্ষার তারিখ (ঐচ্ছিক)</label>
          <input type="date" className={ui.input} value={f.examDate} onChange={(e) => setF({ ...f, examDate: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={ui.label}>দুর্বল দিক / অতিরিক্ত নোট (ঐচ্ছিক)</label>
        <textarea
          className={`${ui.input} min-h-20`}
          value={f.notes}
          maxLength={1000}
          placeholder="যেমন: জৈব রসায়নে দুর্বল, গণিতে বেশি সময় দরকার"
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <button disabled={pending} className={`${ui.btn} ${ui.primary} w-full sm:w-auto`}>
        {pending ? "AI প্ল্যান বানাচ্ছে… (১০–৩০ সেকেন্ড)" : "✨ প্ল্যান তৈরি করো"}
      </button>
      <p className="text-xs text-muted">তৈরি হওয়ার পর আপনি সব টপিক ও সময় দেখে এডিট করতে পারবেন, তারপর অনুমোদন দেবেন।</p>
    </form>
  );
}
