"use client";

import { useTransition } from "react";
import { setUserSuspended } from "@/lib/actions/admin";
import { ui } from "@/components/ui";

export type AdminUserRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  role: "user" | "admin" | "super_admin";
  isSuspended: boolean;
  createdAt: Date;
};

const ROLE_LABEL = { user: "ইউজার", admin: "অ্যাডমিন", super_admin: "সুপার অ্যাডমিন" } as const;

export function UserTable({ users }: { users: AdminUserRow[] }) {
  return (
    <div className={`${ui.card} overflow-x-auto`}>
      <h2 className="mb-3 font-semibold">ইউজার ({users.length})</h2>
      <table className="w-full min-w-[500px] text-left text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 font-medium">নাম / ইমেইল</th>
            <th className="pb-2 font-medium">রোল</th>
            <th className="pb-2 font-medium">অবস্থা</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user }: { user: AdminUserRow }) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      await setUserSuspended(user.id, !user.isSuspended);
    });

  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-2">
        <p className="truncate font-medium">{user.displayName || "—"}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </td>
      <td className="py-2 pr-2 text-xs text-muted">{ROLE_LABEL[user.role]}</td>
      <td className="py-2 pr-2">
        {user.isSuspended ? <span className="text-xs text-error">সাসপেন্ড</span> : <span className="text-xs text-success">সক্রিয়</span>}
      </td>
      <td className="py-2 text-right">
        <button
          disabled={pending || user.role !== "user"}
          onClick={toggle}
          title={user.role !== "user" ? "অ্যাডমিন সাসপেন্ড করা যায় না" : undefined}
          className={`${ui.btn} ${user.isSuspended ? ui.primary : ui.danger} px-3 py-1 text-xs`}
        >
          {pending ? "…" : user.isSuspended ? "আনসাসপেন্ড" : "সাসপেন্ড"}
        </button>
      </td>
    </tr>
  );
}
