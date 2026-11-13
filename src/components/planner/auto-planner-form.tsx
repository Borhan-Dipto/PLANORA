"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoGeneratePlan } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

export function AutoPlannerForm({ learningDays }: { learningDays?: number }) {
  const router = useRouter();
  const EXAMS = ["বিসিএস প্রিলিমিনারি", "বিসিএস লিখিত", "ব্যাংক জব", "প্রাইমারি শিক্ষক", "NTRCA", "বিশ্ববিদ্যালয় সেমিস্টার", "বিশ্ববিদ্যালয় ভর্তি", "মেডিকেল ভর্তি", "HSC", "SSC"];

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
        learningDays,
      });
      if (!res.ok) return setError(res.error);
      router.push(`/planner/${res.id}`);
    });
  };

  return (
    <form onSubmit={submit} className={`${ui.card} space-y-4`}>
      {learningDays && learningDays !== 30 && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 p-2 text-sm">মেয়াদ নির্বাচন করা হয়েছে: {learningDays} দিন</p>
      )}
      <div>
        <label className={ui.label}>কোন পরীক্ষার প্রস্তুতি?</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {EXAMS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setF({ ...f, goal: x })}
              className={`rounded-full border px-3 py-1 text-xs ${f.goal === x ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:text-foreground"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <input
          className={ui.input}
          value={f.goal}
          maxLength={300}
          placeholder="অথবা নিজে লিখুন: ৪৭তম বিসিএস, সোনালী ব্যাংক অফিসার, HSC 2027 বিজ্ঞান…"
          onChange={(e) => setF({ ...f, goal: e.target.value })}
        />
      </div>
      <div>
        <label className={ui.label}>বিষয়সমূহ * <span className="font-normal">(বিসিএস/চাকরির পরীক্ষায় “সিলেবাস অনুযায়ী” লিখলে AI নিজেই সাজিয়ে দেবে)</span></label>
        <textarea
          className={`${ui.input} min-h-24`}
          value={f.subjects}
          maxLength={1500}
          required
          placeholder="যেমন: বাংলা, ইংরেজি, গণিত, বাংলাদেশ বিষয়াবলি — অথবা “পুরো সিলেবাস অনুযায়ী”"
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
          placeholder="যেমন: চাকরির পাশাপাশি পড়ি, ইংরেজি গ্রামারে দুর্বল, গণিতে বেশি সময় দরকার"
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
