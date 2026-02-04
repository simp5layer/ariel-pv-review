import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Deliverable, DeliverableType, DELIVERABLE_METADATA } from "@/types/project";

const order: DeliverableType[] = [
  "ai_prompt_log",
  "design_review_report",
  "issue_register",
  "compliance_checklist",
  "recalculation_sheet",
  "redline_notes",
  "bom_boq",
  "risk_reflection",
];

function statusBadge(status: Deliverable["status"]) {
  switch (status) {
    case "generated":
      return <Badge variant="outline" className="bg-pass/10 text-pass border-pass/20">Generated</Badge>;
    case "updated":
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Updated</Badge>;
    default:
      return <Badge variant="outline" className="bg-muted text-muted-foreground">Not generated</Badge>;
  }
}

export default function DeliverablesViewer({
  deliverables,
  onGenerateMissing,
  isGenerating,
}: {
  deliverables: Deliverable[];
  onGenerateMissing: () => void;
  isGenerating?: boolean;
}) {
  const deliverablesByType = useMemo(() => {
    const m = new Map<DeliverableType, Deliverable>();
    for (const d of deliverables) m.set(d.type, d);
    return m;
  }, [deliverables]);

  const all = useMemo(() => {
    return order.map((type) => {
      return (
        deliverablesByType.get(type) ?? {
          id: `placeholder-${type}`,
          type,
          name: DELIVERABLE_METADATA[type].name,
          status: "not_generated" as const,
        }
      );
    });
  }, [deliverablesByType]);

  const [selected, setSelected] = useState<DeliverableType>("design_review_report");
  const current = deliverablesByType.get(selected);
  const currentMeta = DELIVERABLE_METADATA[selected];

  const missingCount = all.filter((d) => d.status === "not_generated").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {missingCount > 0 && (
            <Button onClick={onGenerateMissing} disabled={isGenerating} className="w-full">
              {isGenerating ? "Generating…" : `Generate Missing (${missingCount})`}
            </Button>
          )}

          <div className="space-y-2">
            {all.map((d) => {
              const active = d.type === selected;
              const meta = DELIVERABLE_METADATA[d.type];
              return (
                <button
                  key={d.type}
                  type="button"
                  onClick={() => setSelected(d.type)}
                  className={
                    "w-full text-left rounded-lg border p-3 transition-colors " +
                    (active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted/30")
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <span className="text-sm font-medium truncate">{meta.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{meta.description}</div>
                    </div>
                    <div className="shrink-0">{statusBadge(d.status)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{currentMeta.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {!current || current.status === "not_generated" ? (
            <div className="text-sm text-muted-foreground">
              Not generated yet. Use “Generate Missing Deliverables” to create this report.
            </div>
          ) : current.content ? (
            <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card p-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{current.content}</pre>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              This deliverable is marked {current.status} but no stored content was found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
