import { Moon, Sun, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { InstallButton } from "@/components/layout/InstallButton";
import { usePreferences } from "@/components/providers/AppProviders";
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
import logo from "@/assets/kemi-logo.png.asset.json";
import type { SupportedLanguage } from "@/i18n";

const languages: { code: SupportedLanguage; label: string }[] = [
  { code: "id", label: "ID" },
  { code: "en", label: "EN" },
];

export function TopBar() {
  const { t } = useTranslation();
  const { theme, toggleTheme, language, setLanguage } = usePreferences();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:px-5">
      <SidebarTrigger className="shrink-0" />

      <div className="flex min-w-0 items-center gap-3">
        <img src={logo.url} alt={t("app.name")} className="h-9 w-9 rounded-lg" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">{t("app.fullName")}</p>
          <p className="truncate text-xs text-brand">{t("app.tagline")}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <InstallButton />

        <div className="flex items-center rounded-md border border-border p-0.5" role="group" aria-label={t("header.language")}>
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("header.account")}>
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("header.guest")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>{t("header.profile")}</DropdownMenuItem>
            <DropdownMenuItem disabled>{t("header.signIn")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
