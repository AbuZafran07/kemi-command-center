import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/**
 * Registers the app-shell service worker and prompts the user to reload when a
 * new version is waiting. Never auto-activates an update: the new SW only takes
 * over once the user explicitly clicks reload (skipWaiting is user-triggered).
 */
export function ServiceWorkerManager() {
  const { t } = useTranslation();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptUpdate = (waiting: ServiceWorker) => {
      toast(t("pwa.updateAvailable"), {
        duration: Infinity,
        action: {
          label: t("pwa.updateReload"),
          onClick: () => waiting.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(installing);
            }
          });
        });
      })
      .catch((error) => {
        console.error("[sw] registration failed", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [t]);

  return null;
}
