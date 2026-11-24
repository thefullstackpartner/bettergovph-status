import categoriesData from '../../src/data/categories.json';
import curatedMonitors from '../../src/data/monitors/curated.json';
import constitutionalSucs from '../../src/data/monitors/imported/constitutional-sucs.json';
import diplomatic from '../../src/data/monitors/imported/diplomatic.json';
import executive from '../../src/data/monitors/imported/executive.json';
import legislative from '../../src/data/monitors/imported/legislative.json';
import type { CategoryDefinition, MonitorDefinition } from '../types';

export const categories: CategoryDefinition[] =
  categoriesData as CategoryDefinition[];

export const allMonitors: MonitorDefinition[] = [
  ...(curatedMonitors as MonitorDefinition[]),
  ...(constitutionalSucs as MonitorDefinition[]),
  ...(diplomatic as MonitorDefinition[]),
  ...(executive as MonitorDefinition[]),
  ...(legislative as MonitorDefinition[]),
];

export const enabledMonitors: MonitorDefinition[] = allMonitors.filter(
  m => m.enabled !== false
);

const bySlugMap = new Map<string, MonitorDefinition>(
  allMonitors.map(m => [m.slug, m])
);

export function getMonitorBySlug(slug: string): MonitorDefinition | undefined {
  return bySlugMap.get(slug);
}
