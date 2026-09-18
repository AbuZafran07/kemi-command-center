import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  Settings,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { useAuth } from "@/components/providers/AppProviders";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { listMyAgents } from "@/lib/agents.functions";

const items = [
  { key: "dashboard", url: "/", icon: LayoutDashboard },
  { key: "agents", url: "/agents", icon: Bot },
  { key: "chat", url: "/chat", icon: MessagesSquare },
  { key: "requests", url: "/requests", icon: KeyRound },
  { key: "settings", url: "/settings", icon: Settings },
] as const;

const APPROVER_ROLES = ["CEO", "Director", "Manager"];
const AUDIT_ROLES = ["CEO", "Director"];
const BRIEFING_ROLES = ["CEO", "Director"];

const CHAT_ENABLED = ["ARCA", "JOKO", "WAWAN", "ALDI", "SALLY", "PIA", "PURI"];

export function AppSidebar() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchAgents = useServerFn(listMyAgents);

  const { data } = useQuery({
    queryKey: ["my-agents"],
    queryFn: () => fetchAgents(),
    enabled: Boolean(user),
  });
  const agents = data ?? [];

  const navItems = [
    ...items.filter((item) => item.key !== "settings"),
    ...(role && BRIEFING_ROLES.includes(role)
      ? [{ key: "briefing", url: "/briefing", icon: Sparkles } as const]
      : []),
    ...(role && APPROVER_ROLES.includes(role)
      ? [{ key: "approvals", url: "/approvals", icon: ClipboardCheck } as const]
      : []),
    ...(role && AUDIT_ROLES.includes(role)
      ? [{ key: "audit", url: "/audit", icon: ScrollText } as const]
      : []),
    ...items.filter((item) => item.key === "settings"),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.sectionMain")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{t(`nav.${item.key}`)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {agents.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.sectionAgents")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {agents.map((agent) => {
                  const href = CHAT_ENABLED.includes(agent.code) ? "/chat/$code" : "/agents";
                  return (
                    <SidebarMenuItem key={agent.code}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === `/chat/${agent.code.toLowerCase()}`}
                      >
                        <Link
                          to={href}
                          {...(href === "/chat/$code"
                            ? { params: { code: agent.code.toLowerCase() } }
                            : {})}
                          className="flex items-center gap-2"
                        >
                          <AgentAvatar name={agent.name} color={agent.avatar_color} size="sm" />
                          <span className="truncate">{agent.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
