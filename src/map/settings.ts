export type GraphicsPreset = 'Low' | 'Medium' | 'High' | 'Ultra';
export const GRAPHICS = {
  Low: { terrain: false, shadows: false, water: false, cityBudget: 8, borderWidth: 0.8 },
  Medium: { terrain: true, shadows: false, water: false, cityBudget: 24, borderWidth: 1 },
  High: { terrain: true, shadows: true, water: true, cityBudget: 60, borderWidth: 1.1 },
  Ultra: { terrain: true, shadows: true, water: true, cityBudget: 100, borderWidth: 1.3 },
} as const;
export type MapMode = 'Political' | 'Diplomatic' | 'Relations' | 'Economy' | 'Population' | 'Religion' | 'Government' | 'Military' | 'Resources' | 'Terrain' | 'Stability' | 'Development';
// Only modes backed by the current server schema are selectable in this phase.
export const AVAILABLE_MODES: MapMode[] = ['Political', 'Government', 'Economy', 'Population', 'Military', 'Terrain', 'Stability'];
export const MODE_LABELS: Record<MapMode, string> = { Political: 'Политическая', Diplomatic: 'Дипломатия', Relations: 'Отношения', Economy: 'Экономика', Population: 'Население', Religion: 'Религия', Government: 'Правительство', Military: 'Армии', Resources: 'Ресурсы', Terrain: 'Рельеф', Stability: 'Стабильность', Development: 'Развитие' };
