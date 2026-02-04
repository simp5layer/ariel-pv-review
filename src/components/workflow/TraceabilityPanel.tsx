import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ExtractedParameter } from "@/types/project";

export type TraceabilityItem = {
  label: string;
  traceKey: string;
  fallbackKeys?: string[];
};

function pickTrace(
  trace: Record<string, ExtractedParameter> | undefined,
  traceKey: string,
  fallbackKeys: string[] = []
): ExtractedParameter | undefined {
  if (!trace) return undefined;
  return trace[traceKey] || fallbackKeys.map((k) => trace[k]).find(Boolean);
}

export default function TraceabilityPanel({
  title = "Source / Traceability",
  trace,
  items,
}: {
  title?: string;
  trace?: Record<string, ExtractedParameter>;
  items: TraceabilityItem[];
}) {
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[220px]">Value</TableHead>
                <TableHead className="w-[140px]">Extracted</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const t = pickTrace(trace, it.traceKey, it.fallbackKeys);
                return (
                  <TableRow key={it.traceKey} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{it.label}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {t ? (
                        <span>
                          {String(t.value)}{t.unit ? ` ${t.unit}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="bg-card">
                            {t.sourceFile}
                          </Badge>
                          <span className="text-muted-foreground">{t.sourceReference}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No source available</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
