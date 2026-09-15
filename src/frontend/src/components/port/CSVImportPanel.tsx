import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VesselType, VesselPriority } from "@/lib/port/types";

interface ImportedVessel {
  vessel_id: string;
  type: VesselType;
  cargo: string;
  eta_hours: number;
  priority: VesselPriority;
}

interface ImportResult {
  success: boolean;
  added: number;
  errors: string[];
}

const VESSEL_TYPES = ["Container", "Bulk", "Tanker"];
const PRIORITY_OPTIONS = ["standard", "priority"];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function CSVImportPanel({
  onImport,
  existingIds,
}: {
  onImport: (vessels: ImportedVessel[]) => ImportResult;
  existingIds: string[];
}) {
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<ImportedVessel[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ImportedVessel[] => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0] ?? "").map((h) => h.toLowerCase());
    const vessels: ImportedVessel[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i] ?? "");
      if (values.length < 4) continue;

      const idIdx = headers.findIndex((h) => h.includes("id") || h.includes("vessel"));
      const typeIdx = headers.findIndex((h) => h.includes("type"));
      const cargoIdx = headers.findIndex((h) => h.includes("cargo"));
      const etaIdx = headers.findIndex((h) => h.includes("eta") || h.includes("arrival"));
      const prioIdx = headers.findIndex((h) => h.includes("priority") || h.includes("prio"));

      const id = (values[idIdx] ?? "") || `V${100 + i}`;
      const typeValue = values[typeIdx] ?? "";
      const type = VESSEL_TYPES.includes(typeValue) ? typeValue as VesselType : "Container";
      const cargo = (values[cargoIdx] ?? "") || "General";
      const etaValue = values[etaIdx] ?? "";
      const eta = Number(etaValue) || 24;
      const prioValue = values[prioIdx] ?? "";
      const priority = PRIORITY_OPTIONS.includes(prioValue)
        ? prioValue as VesselPriority
        : "standard";

      vessels.push({ vessel_id: id, type, cargo, eta_hours: eta, priority });
    }
    return vessels;
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const vessels = parseCSV(text);
      setPreview(vessels);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleImport = () => {
    const res = onImport(preview);
    setResult(res);
    if (res.added > 0) setPreview([]);
  };

  return (
    <section className="panel p-4">
      <header className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="size-4 text-primary" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Import vessels from CSV
          </h2>
          <p className="text-xs text-muted-foreground">
            Columns: vessel_id, type, cargo, eta_hours, priority
          </p>
        </div>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors ${
          dragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Drop CSV file here or click to browse
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {preview.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {preview.length} vessel(s) parsed from CSV
          </p>
          <div className="max-h-32 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">ID</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Cargo</th>
                  <th className="px-2 py-1 text-left">ETA</th>
                  <th className="px-2 py-1 text-left">Priority</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((v, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-2 py-1 num">{v.vessel_id}</td>
                    <td className="px-2 py-1">{v.type}</td>
                    <td className="px-2 py-1">{v.cargo}</td>
                    <td className="px-2 py-1 num">{v.eta_hours}h</td>
                    <td className="px-2 py-1">{v.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 5 && (
            <p className="text-xs text-muted-foreground">...and {preview.length - 5} more</p>
          )}
          <Button size="sm" onClick={handleImport}>
            Import {preview.length} vessel(s)
          </Button>
        </div>
      )}

      {result && (
        <div className={`mt-3 flex items-start gap-2 rounded-md p-2 text-xs ${
          result.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        }`}>
          {result.success ? (
            <CheckCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          )}
          <div>
            <p>{result.added} vessel(s) imported successfully</p>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-3">
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
