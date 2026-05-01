export type Framework =
  | "react-router" | "next-app" | "vite-router"
  | "tanstack-router" | "astro" | "unknown";

export interface ScanResult {
  framework: Framework;
  base_url: string;
  pages: PageEntry[];
  flows: FlowEntry[];
  warnings: Warning[];
}

export interface PageEntry {
  id: string;
  route: string;
  title: string;
  graph_node?: string;
  primary_actions: ActionHint[];
  requires_auth: boolean;
  needs_seed: boolean;
  importance: number;
}

export interface ActionHint {
  selector: string;
  label: string;
  kind: "click" | "input" | "submit" | "link";
}

export interface FlowEntry {
  id: string;
  name: string;
  page_ids: string[];
}

export interface Warning {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
