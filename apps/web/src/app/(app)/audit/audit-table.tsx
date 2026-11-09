"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, CardContent, Table, TBody, TD, TH, THead, TR } from "@vetnex/ui";
import { apiRequest, errorMessage } from "@/lib/client-api";
import type { AuditPage } from "@/lib/types";
import { Icon } from "@/components/icons";

export function AuditTable({ initial, timezone }: { initial: AuditPage; timezone: string }) {
  const [showMetadata, setShowMetadata] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["audit"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiRequest<AuditPage>(`/audit?limit=25${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: { pages: [initial], pageParams: [undefined] },
  });

  const events = query.data?.pages.flatMap((page) => page.events) ?? [];

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString("en-AU");
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        {query.isError ? (
          <div className="p-4">
            <Alert tone="danger" icon={<Icon name="alert" />}>
              {errorMessage(query.error)}
            </Alert>
          </div>
        ) : null}

        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Event</TH>
              <TH>Summary</TH>
              <TH>Actor</TH>
              <TH>Request</TH>
            </TR>
          </THead>
          <TBody>
            {events.map((event) => (
              <TR key={event.id}>
                <TD className="whitespace-nowrap text-[12px] text-muted-foreground">
                  {formatDate(event.createdAt)}
                </TD>
                <TD>
                  <Badge tone="neutral" className="font-mono text-[10.5px]">
                    {event.action}
                  </Badge>
                </TD>
                <TD className="min-w-64">
                  <p className="text-[13px] text-foreground">{event.summary}</p>
                  <button
                    type="button"
                    className="mt-0.5 text-[11px] text-primary hover:underline"
                    onClick={() => setShowMetadata(showMetadata === event.id ? null : event.id)}
                  >
                    {showMetadata === event.id ? "Hide detail" : "Show detail"}
                  </button>
                  {showMetadata === event.id ? (
                    <pre className="mt-1.5 max-h-48 overflow-auto rounded-sm bg-muted p-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(
                        {
                          entity: `${event.entityType}${event.entityId ? `:${event.entityId}` : ""}`,
                          metadata: event.metadata,
                          ip: event.ipAddress,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  ) : null}
                </TD>
                <TD className="text-[12px] text-muted-foreground">{event.actorLabel}</TD>
                <TD className="font-mono text-[10.5px] text-muted-foreground">
                  {event.requestId ? event.requestId.slice(0, 8) : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            Showing {events.length} {events.length === 1 ? "event" : "events"}
          </p>
          {query.hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load older events
            </Button>
          ) : (
            <p className="text-[12px] text-muted-foreground">End of retained history</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
