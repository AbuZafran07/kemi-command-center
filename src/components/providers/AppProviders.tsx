import { useRouter } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import type { User } from "@supabase/supabase-js";

import i18n, { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "kemi.theme";

export type AppRole = "CEO" | "Director" | "Manager" | "Supervisor" | "Staff";

export type Profile = {
  id: string;
  full_name: string;
  division: string;
  language_pref: string;
  theme_pref: string;
};

type AppPreferences = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
};

type AuthState = {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const PreferencesContext = createContext<AppPreferences | null>(null);
const AuthContext = createContext<AuthState | null>(null);

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside AppProviders");
  return ctx;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AppProviders");
  return ctx;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [theme, setThemeState] = useState<Theme>("light");
  const [language, setLanguageState] = useState<SupportedLanguage>("id");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  // Read stored preferences after hydration to keep SSR markup stable.
  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme: Theme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : prefersDark
        ? "dark"
        : "light";
    setThemeState(nextTheme);

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && (SUPPORTED_LANGUAGES as readonly string[]).includes(storedLanguage)) {
      setLanguageState(storedLanguage as SupportedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    userIdRef.current = currentUser?.id ?? null;
    if (!currentUser) {
      setProfile(null);
      setRole(null);
      return;
    }

    const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, division, language_pref, theme_pref")
        .eq("id", currentUser.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
    ]);

    setProfile((profileRow as Profile | null) ?? null);
    setRole(((roleRows?.[0]?.role as AppRole | undefined) ?? null));

    if (profileRow) {
      const pref = profileRow as Profile;
      if (pref.theme_pref === "dark" || pref.theme_pref === "light") setThemeState(pref.theme_pref);
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(pref.language_pref)) {
        setLanguageState(pref.language_pref as SupportedLanguage);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user ?? null);
      if (active) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRole(null);
      } else if (nextUser && nextUser.id !== userIdRef.current) {
        void loadProfile(nextUser);
      }
      void router.invalidate();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, router]);

  const persistPreference = useCallback((patch: Partial<Pick<Profile, "theme_pref" | "language_pref">>) => {
    const id = userIdRef.current;
    if (!id) return;
    void supabase.from("profiles").update(patch).eq("id", id);
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    persistPreference({ theme_pref: next });
  }, [persistPreference]);

  const setLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    persistPreference({ language_pref: next });
  }, [persistPreference]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    userIdRef.current = null;
    await router.navigate({ to: "/auth", replace: true });
  }, [router]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await loadProfile(data.user ?? null);
  }, [loadProfile]);

  return (
    <I18nextProvider i18n={i18n}>
      <PreferencesContext.Provider value={{ theme, setTheme, toggleTheme, language, setLanguage }}>
        <AuthContext.Provider value={{ user, profile, role, loading, signOut, refreshProfile }}>
          {children}
        </AuthContext.Provider>
      </PreferencesContext.Provider>
    </I18nextProvider>
  );
}
