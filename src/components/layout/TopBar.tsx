import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, LogOut, Moon, Search, Sun, User } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CommandPalette, useCommandPaletteShortcut } from "@/components/layout/CommandPalette";
import { InstallButton } from "@/components/layout/InstallButton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { useAuth, usePreferences } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { listPendingActionApprovals } from "@/lib/actions.functions";
import { listPendingApprovals } from "@/lib/access.functions";
import type { SupportedLanguage } from "@/i18n";

const languages: { code: SupportedLanguage; label: string }[] = [
  { code: "id", label: "ID" },
  { code: "en", label: "EN" },
];

const APPROVER_ROLES = ["CEO", "Director", "Manager"];

export function TopBar() {
  const { t } = useTranslation();
  const { theme, toggleTheme, language, setLanguage } = usePreferences();
  const { user, profile, role, signOut } = useAuth();
  const displayName = profile?.full_name || user?.email || t("header.guest");
  const isApprover = Boolean(role && APPROVER_ROLES.includes(role));

  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(setPaletteOpen);

  const fetchAccessApprovals = useServerFn(listPendingApprovals);
  const fetchActionApprovals = useServerFn(listPendingActionApprovals);
  const accessQuery = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => fetchAccessApprovals(),
    enabled: isApprover,
  });
  const actionQuery = useQuery({
    queryKey: ["pending-action-approvals"],
    queryFn: () => fetchActionApprovals(),
    enabled: isApprover,
  });
  const pendingCount = (accessQuery.data?.length ?? 0) + (actionQuery.data?.length ?? 0);

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-3 sm:px-5">
      <SidebarTrigger className="shrink-0" />

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden min-w-0 max-w-sm flex-1 items-center gap-2 rounded-lg border border-input bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground sm:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">{t("search.placeholder")}</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:flex">
          ⌘K
        </kbd>
      </button>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setPaletteOpen(true)}
          aria-label={t("search.placeholder")}
        >
          <Search className="h-4 w-4" />
        </Button>

        <InstallButton />

        <div
          className="flex items-center rounded-md border border-border p-0.5"
          role="group"
          aria-label={t("header.language")}
        >
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setLanguage(item.code)}
              aria-pressed={language === item.code}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                language === item.code
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {isApprover ? (
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link to="/approvals" aria-label={t("header.notifications")}>
              <Bell className="h-4 w-4" />
              {pendingCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
              ) : null}
            </Link>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-transparent py-0.5 pl-0.5 pr-2.5 transition-colors hover:border-border hover:bg-accent"
            >
              <UserAvatar name={displayName} avatarUrl={profile?.avatar_url} size="sm" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium">{displayName}</span>
                {role ? (
                  <span className="block text-[11px] text-muted-foreground">{role}</span>
                ) : null}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block">{displayName}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {role ?? t("header.guest")}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <User className="mr-2 h-4 w-4" />
                {t("header.profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("header.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
