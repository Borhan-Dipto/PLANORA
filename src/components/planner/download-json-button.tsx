"use client";

import { downloadJson } from "@/lib/plan/import";
import type { PlanData } from "@/lib/plan/schema";
import { ui } from "@/components/ui";

export function DownloadJsonButton({ plan }: { plan: PlanData }) {
  return (
    <button type="button" onClick={() => downloadJson(plan)} className={`${ui.btn} ${ui.secondary}`}>
      ⬇ JSON ডাউনলোড
    </button>
  );
}
