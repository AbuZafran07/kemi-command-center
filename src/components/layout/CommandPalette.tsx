import { useNavigate } from "@tanstack/react-router";
import {
  Bot,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/AppProviders";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const PAGES = [
  { key: "dashboard", url: "/", icon: LayoutDashboard, roles: null },
  { key: "agents", url: "/agents", icon: Bot, roles: null },
  { key: "chat", url: "/chat", icon: MessagesSquare, roles: null },
  { key: "requests", url: "/requests", icon: KeyRound, roles: null },
  { key: "actions", url: "/actions", icon: ShieldCheck, roles: null },
  { key: "briefing", url: "/briefing", icon: Sparkles, roles: ["CEO", "Director"] },
  {
    key: "approvals",
    url: "/approvals",
    icon: ClipboardCheck,
    roles: ["CEO", "Director", "Manager"],
  },
  { key: "audit", url: "/audit", icon: ScrollText, roles: ["CEO", "Director"] },
  { key: "settings", url: "/settings", icon: Settings, roles: null },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, isSuperAdmin } = useAuth();

  const pages = [
    ...PAGES.filter(
      (page) => !page.roles || (role && (page.roles as readonly string[]).includes(role)),
    ),
    ...(isSuperAdmin ? [{ key: "admin", url: "/admin" as const, icon: UserCog, roles: null }] : []),
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("search.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("search.empty")}</CommandEmpty>
        <CommandGroup heading={t("search.pages")}>
          {pages.map((page) => (
            <CommandItem
              key={page.key}
              value={t(`nav.${page.key}`)}
              onSelect={() => {
                onOpenChange(false);
                void navigate({ to: page.url });
              }}
            >
              <page.icon className="text-brand" />
              {t(`nav.${page.key}`)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Opens the palette on Cmd/Ctrl+K from anywhere in the app. */
export function useCommandPaletteShortcut(onOpenChange: (open: boolean) => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpenChange]);
}
