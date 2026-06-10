// types.ts — TypeScript shape of content.json (the learn-site data model).
// Mirrors the agreed schema exactly so the app type-checks against the imported JSON.

export type Side = 'frontend' | 'backend' | 'crosscutting';

export interface Component {
  name: string;
  what: string;
  ref: string;
}

export interface Layer {
  id: string;
  num: string;
  name: string;
  icon: string;
  order: number;
  side: Side;
  plain: string;
  /** LIGHT MARKDOWN */
  deep: string;
  components: Component[];
  depends_on: string[];
  used_by: string[];
  connects: string;
}

export interface FlowStep {
  step: number;
  layerId: string;
  title: string;
  plain: string;
  deep: string;
}

export interface GlossaryEntry {
  term: string;
  plain: string;
}

export interface Project {
  name: string;
  tagline: string;
  summary_plain: string;
  summary_deep: string;
  stack: string[];
}

export interface Content {
  project: Project;
  layers: Layer[];
  flow: FlowStep[];
  glossary: GlossaryEntry[];
}

/** Reading register: plain-English vs. deeper technical dive. */
export type Register = 'plain' | 'deep';
