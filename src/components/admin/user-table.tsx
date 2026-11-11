"use client";

import { useTransition } from "react";
import { setUserSuspended, setUserRole } from "@/lib/actions/admin";
import { ui } from "@/components/ui";

export type AdminUserRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  role: "user" | "moderator" | "manager" | "admin" | "super_admin";
  isSuspended: boolean;
  createdAt: Date;
};

const ROLE_LABEL = {
  user: "ইউজার",
  moderator: "মডারেটর",
  manager: "ম্যানেজার",
  admin: "অ্যাডমিন",
  super_admin: "সুপার অ্যাডমিন",
} as const;

const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[];

export function UserTable({ users, canManageRoles }: { users: AdminUserRow[]; canManageRoles: boolean }) {
  return (
    <div className={`${ui.card} overflow-x-auto`}>
      <h2 className="mb-3 font-semibold">ইউজার ({users.length})</h2>
      <table className="w-full min-w-[560px] text-left text-sm">
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
            <UserRow key={u.id} user={u} canManageRoles={canManageRoles} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user, canManageRoles }: { user: AdminUserRow; canManageRoles: boolean }) {
  const [pending, start] = useTransition();
  const [roleSaving, startRole] = useTransition();

  const toggleSuspend = () =>
    start(async () => {
      await setUserSuspended(user.id, !user.isSuspended);
    });

  const changeRole = (role: string) =>
    startRole(async () => {
      await setUserRole(user.id, role);
    });

  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-2">
        <p className="truncate font-medium">{user.displayName || "—"}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </td>
      <td className="py-2 pr-2 text-xs">
        {canManageRoles ? (
          <select
            defaultValue={user.role}
            disabled={roleSaving}
            onChange={(e) => changeRole(e.target.value)}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-foreground disabled:opacity-50"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted">{ROLE_LABEL[user.role]}</span>
        )}
      </td>
      <td className="py-2 pr-2">
        {user.isSuspended ? <span className="text-xs text-error">সাসপেন্ড</span> : <span className="text-xs text-success">সক্রিয়</span>}
      </td>
      <td className="py-2 text-right">
        <button
          disabled={pending || user.role !== "user"}
          onClick={toggleSuspend}
          title={user.role !== "user" ? "স্টাফ ইউজার সাসপেন্ড করা যায় না" : undefined}
          className={`${ui.btn} ${user.isSuspended ? ui.primary : ui.danger} px-3 py-1 text-xs`}
        >
          {pending ? "…" : user.isSuspended ? "আনসাসপেন্ড" : "সাসপেন্ড"}
        </button>
      </td>
    </tr>
  );
}
