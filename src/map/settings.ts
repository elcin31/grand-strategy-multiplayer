export type GraphicsPreset = 'Performance' | 'Balanced' | 'High' | 'Ultra';
export const GRAPHICS = {
  Performance: { terrain: false, shadows: false, water: false, cityBudget: 8, objectBudget: 16, routeBudget: 8, borderWidth: 0.8 },
  Balanced: { terrain: true, shadows: false, water: false, cityBudget: 24, objectBudget: 48, routeBudget: 20, borderWidth: 1 },
  High: { terrain: true, shadows: true, water: true, cityBudget: 48, objectBudget: 80, routeBudget: 32, borderWidth: 1.1 },
  Ultra: { terrain: true, shadows: true, water: true, cityBudget: 76, objectBudget: 112, routeBudget: 42, borderWidth: 1.3 },
} as const;
export type MapMode = 'Political' | 'Diplomatic' | 'Relations' | 'Economy' | 'Population' | 'Religion' | 'Government' | 'Military' | 'Resources' | 'Terrain' | 'Province' | 'Stability' | 'Development';
// All modes derive from the authoritative snapshot.
export const AVAILABLE_MODES: MapMode[] = ['Political','Diplomatic','Relations','Economy','Population','Religion','Government','Military','Resources','Terrain','Province','Stability','Development'];
export const MODE_LABELS: Record<MapMode, string> = { Political: 'Политическая', Diplomatic: 'Дипломатия', Relations: 'Отношения', Economy: 'Экономика', Population: 'Население', Religion: 'Религия', Government: 'Правительство', Military: 'Армии', Resources: 'Ресурсы', Terrain: 'Рельеф', Province: 'Провинции', Stability: 'Стабильность', Development: 'Развитие' };
