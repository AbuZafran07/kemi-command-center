import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { RequestAccessDialog } from "@/components/agents/RequestAccessDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getAgentConversation,
  sendAgentMessage,
  type ChatMessage,
  type ChatSource,
} from "@/lib/agent-chat.functions";
import { getAgentDetail } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/chat/$code")({
  head: () => ({
    meta: [
      { title: "Obrolan Agen — KEMI" },
      { name: "description", content: "Berdialog dengan agen KEMI sesuai kewenangan Anda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentChatPage,
});


function AgentChatPage() {
  const { code } = Route.useParams();
  const agentCode = code.toUpperCase();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const fetchDetail = useServerFn(getAgentDetail);
  const fetchConversation = useServerFn(getAgentConversation);
  const send = useServerFn(sendAgentMessage);

  const detailQuery = useQuery({
    queryKey: ["agent-detail", agentCode],
    queryFn: () => fetchDetail({ data: { code: agentCode } }),
  });

  const allowed = detailQuery.data?.allowed === true;
  const agent = detailQuery.data?.agent ?? null;

  const conversationQuery = useQuery({
    queryKey: ["agent-conversation", agentCode],
    queryFn: () => fetchConversation({ data: { agentCode } }),
    enabled: allowed,
  });

  const messages = (conversationQuery.data?.messages ?? []) as ChatMessage[];
  const conversationId = conversationQuery.data?.conversationId ?? null;

  const mutation = useMutation({
    mutationFn: (message: string) => send({ data: { agentCode, message, conversationId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-conversation", agentCode] });
    },
    onError: (error: Error) => {
      const key = error.message.includes("FORBIDDEN_AGENT")
        ? "chat.errorForbidden"
        : error.message.includes("AI_RATE_LIMITED")
          ? "chat.errorRate"
          : error.message.includes("AI_UNAVAILABLE")
            ? "chat.errorUnavailable"
            : "chat.errorGeneric";
      toast.error(t(key));
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, mutation.isPending]);

  if (detailQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[70vh] rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!agent || !allowed) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-lg font-semibold">{t("chat.deniedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {!agent ? t("chat.deniedUnknown") : t("chat.deniedBody", { agent: agent.name })}
            </p>
          </div>
          <div className="flex gap-2">
            {agent && !allowed ? (
              <RequestAccessDialog
                agentCode={agent.code}
                agentName={agent.name}
                trigger={<Button variant="brand">{t("chat.requestAccess")}</Button>}
              />
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/agents">{t("chat.backToAgents")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const sources = (lastAssistant?.sources ?? []) as ChatSource[];

  const handleSend = () => {
    const value = input.trim();
    if (!value || mutation.isPending) return;
    setInput("");
    mutation.mutate(value);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-h-[70vh] flex-col rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{agent.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {agent.role} · {agent.division}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !mutation.isPending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("chat.emptyThread", { agent: agent.name })}
            </p>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-soft ${
                  message.role === "user"
                    ? "whitespace-pre-wrap bg-gradient-brand text-brand-foreground"
                    : "glass border text-foreground"
                }`}
              >
                {message.role === "user" ? (
                  message.content
                ) : (
                  <>
                  <div className="mb-1.5 flex items-center gap-2">
                    <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} size="sm" />
                    <span className="text-xs font-medium">{agent.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {agent.division}
                    </Badge>
                  </div>
                  <div className="space-y-2 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-xs [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {mutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("chat.thinking", { agent: agent.name })}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("chat.inputPlaceholder")}
              rows={2}
              className="resize-none"
            />
            <Button variant="brand" onClick={handleSend} disabled={mutation.isPending}>
              <Send className="h-4 w-4" />
              <span className="sr-only">{t("chat.send")}</span>
            </Button>
          </div>
        </div>
      </div>

      <Card className="h-fit shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("chat.sourcesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {sources.length === 0 ? (
            <p className="text-muted-foreground">{t("chat.sourcesEmpty")}</p>
          ) : (
            <ul className="space-y-3">
              {sources.map((source) => (
                <li key={source.code} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{source.system}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{source.classification}</Badge>
                    {source.is_demo ? <Badge variant="outline">{t("chat.demoData")}</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t("chat.dataAsOf")}
            </p>
            <p>{lastAssistant?.data_as_of || "—"}</p>
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="bg-brand text-brand-foreground">{t("dashboard.tagFact")}</Badge>
              <Badge variant="secondary">{t("dashboard.tagAnalysis")}</Badge>
              <span className="font-medium text-foreground">{t("chat.factVsAnalysis")}</span>
            </div>
            <p className="mt-1.5">{t("chat.factVsAnalysisDesc")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
