import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppShell";
import { getMyAdminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin — KEMI" }, { name: "robots", content: "noindex" }],
  }),
  // The status comes from the server (has_role), not from client state. Every admin
  // server function is gated again by requireSuperAdmin, so this guard is only UX.
  beforeLoad: async () => {
    let isSuperAdmin = false;
    try {
      isSuperAdmin = (await getMyAdminStatus()).isSuperAdmin;
    } catch {
      isSuperAdmin = false;
    }
    if (!isSuperAdmin) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />
      <nav className="mb-6 flex gap-1 border-b border-border">
        <Link
          to="/admin/users"
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          activeProps={{ className: "border-brand text-foreground" }}
        >
          {t("admin.navUsers")}
        </Link>
      </nav>
      <Outlet />
    </>
  );
}
