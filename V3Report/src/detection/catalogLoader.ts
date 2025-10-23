import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

export interface DrupalCatalog {
  version: string;
  entity_sets: {
    paragraphs: string[];
    nodes: string[];
    media: string[];
    files: string[];
    taxonomy_terms: string[];
  };
}

export interface SignatureSkeleton {
  key: string;
  name: string;
  tags: string[];
  priority: number;
  class_patterns: string[];
  min_confidence: number;
}

export function loadCatalog(baseDir: string): DrupalCatalog {
  const filePath = join(baseDir, 'config', 'drupal_component_catalog.yaml');
  const raw = readFileSync(filePath, 'utf-8');
  const data = YAML.parse(raw);
  return data as DrupalCatalog;
}

function humanize(bundle: string) {
  return bundle.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function deriveSkeletons(catalog: DrupalCatalog): SignatureSkeleton[] {
  const out: SignatureSkeleton[] = [];

  for (const p of catalog.entity_sets.paragraphs) {
    out.push({
      key: `paragraph_${p}`,
      name: humanize(p),
      tags: ['paragraph'],
      priority: 50,
      class_patterns: [
        `^paragraph--${escapeRegex(p)}($|--)`,
        `^paragraph--type--${escapeRegex(p)}($|--)`,
        // hyphen variant if underscores present
        ...(p.includes('_') ? [
          `^paragraph--${escapeRegex(p.replace(/_/g, '-'))}($|--)`,
          `^paragraph--type--${escapeRegex(p.replace(/_/g, '-'))}($|--)`
        ] : [])
      ],
      min_confidence: 45
    });
  }

  for (const n of catalog.entity_sets.nodes) {
    out.push({
      key: `node_${n}`,
      name: humanize(n),
      tags: ['node'],
      priority: 40,
      class_patterns: [
        `^node--${escapeRegex(n)}($|--)`,
        ...(n.includes('_') ? [ `^node--${escapeRegex(n.replace(/_/g, '-'))}($|--)` ] : [])
      ],
      min_confidence: 40
    });
  }

  for (const m of catalog.entity_sets.media) {
    out.push({
      key: `media_${m}`,
      name: humanize(m),
      tags: ['media'],
      priority: 30,
      class_patterns: [
        `^media--${escapeRegex(m)}($|--)`,
        ...(m.includes('_') ? [ `^media--${escapeRegex(m.replace(/_/g, '-'))}($|--)` ] : [])
      ],
      min_confidence: 35
    });
  }

  for (const t of catalog.entity_sets.taxonomy_terms) {
    out.push({
      key: `taxonomy_${t}`,
      name: humanize(t),
      tags: ['taxonomy'],
      priority: 25,
      class_patterns: [
        `^taxonomy-term--${escapeRegex(t)}($|--)`,
        ...(t.includes('_') ? [ `^taxonomy-term--${escapeRegex(t.replace(/_/g, '-'))}($|--)` ] : [])
      ],
      min_confidence: 35
    });
  }

  return out;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`);
}

// Simple matcher utility for a single class token
export function matchClassToken(token: string, skeletons: SignatureSkeleton[]): SignatureSkeleton[] {
  const matches: SignatureSkeleton[] = [];
  for (const sk of skeletons) {
    for (const pattern of sk.class_patterns) {
      if (new RegExp(pattern).test(token)) {
        matches.push(sk);
        break;
      }
    }
  }
  return matches;
}
