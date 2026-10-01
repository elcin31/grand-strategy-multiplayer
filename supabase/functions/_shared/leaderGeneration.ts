import type { Leader } from './gameTypes.ts';

type NamePool = { given: readonly string[]; family: readonly string[] };
const pools: Record<string, NamePool> = {
  Africa: { given: ['Taremi','Luwani','Adisa','Nolani','Kito','Zubari','Imani','Sefu','Niazi','Bahari','Kamari','Thandi'], family: ['Mokaya','Ndlovu','Sembene','Okoro','Maseko','Diallo','Afolu','Bantane','Kawari','Zuberi','Tendaji','Mbeki'] },
  Americas: { given: ['Alina','Mateo','Yaretzi','Caro','Lucero','Amaru','Noemi','Inti','Belis','Nayeli','Tomas','Aymara'], family: ['Delmar','Castañel','Varela','Quispe','Monteluz','Arriaga','Solano','Maristal','Cayena','Valdoro','Yupanqui','Brumaz'] },
  Asia: { given: ['Meilin','Daichi','Suyin','Haruto','Anika','Kavi','Renji','Linhai','Yejun','Mahana','Tseren','Aarav'], family: ['Kiyora','Senvara','Matsuda','Tenzu','Chandari','Hoshino','Nyima','Varani','Zorigen','Hanami','Kailash','Dawa'] },
  Europe: { given: ['Mirek','Alina','Dorian','Ilva','Marek','Ansel','Eliska','Toma','Liora','Neris','Sabin','Vesna'], family: ['Vaskor','Belovar','Neradin','Sorelli','Kovalen','Marovic','Eldren','Pavren','Tavelli','Corvane','Radek','Velorin'] },
  Oceania: { given: ['Malia','Koa','Tavita','Mea','Arihi','Noa','Lani','Tane','Moana','Keahi','Rangi','Sina'], family: ['Tevaru','Mareko','Falaniko','Vaitoa','Raukura','Tupena','Kelea','Ngaru','Faumuina','Talani','Matareva','Pekahi'] },
};
const fallback: NamePool = { given: ['Arel','Neria','Soren','Talvi'], family: ['Veyran','Ordel','Namar','Selori'] };
const ideologies = ['Civic Reformist','National Conservative','Social Democrat','Liberal Pluralist','State Pragmatist','Traditionalist','Green Developmentalist','Technocratic Centrist','Sovereigntist'] as const;
const traits = ['Pragmatic','Charismatic','Cautious','Strategic','Technocratic','Patient','Decisive','Consensus Builder','Reform Minded','Steady'] as const;

function seedFor(countryId: string, campaignSeed: number): number {
  let hash = (2166136261 ^ campaignSeed) >>> 0;
  for (let i = 0; i < countryId.length; i++) hash = Math.imul(hash ^ countryId.charCodeAt(i), 16777619) >>> 0;
  return hash || 0x6d2b79f5;
}

/** Pure campaign-seeded generator; the same saved campaign always gets identical fictional leaders. */
export function generateLeader(countryId: string, campaignSeed: number, region: string): Leader {
  if (!/^[a-z0-9-]{2,16}$/.test(countryId) || !Number.isSafeInteger(campaignSeed) || campaignSeed < 0) throw new Error('Invalid leader seed');
  let state = seedFor(countryId, campaignSeed);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const pool = pools[region] ?? fallback;
  const choose = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)]!;
  const first = choose(pool.given);
  const surname = choose(pool.family);
  const traitCount = 2 + Math.floor(random() * 2);
  const selectedTraits = new Set<string>();
  while (selectedTraits.size < traitCount) selectedTraits.add(choose(traits));
  const portraitSeed = Math.floor(random() * 2 ** 31);
  return {
    id: `leader-${countryId}-${campaignSeed}`,
    name: `${first} ${surname}`,
    countryId,
    age: 35 + Math.floor(random() * 44),
    portraitSeed,
    ideology: choose(ideologies),
    traits: [...selectedTraits],
    militarySkill: 20 + Math.floor(random() * 61),
    diplomaticSkill: 20 + Math.floor(random() * 61),
    economicSkill: 20 + Math.floor(random() * 61),
    popularity: 25 + Math.floor(random() * 66),
  };
}
