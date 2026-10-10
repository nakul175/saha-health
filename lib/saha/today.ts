import type { Person } from './types';

export type TodayRow = Pick<Person, 'id' | 'name' | 'village'>;
export type TodayRecord = TodayRow & Pick<Person, 'age' | 'sex'>;
export type TodayResponse = { records: TodayRow[] } | { record: TodayRecord };

export function todayRow(person: Person): TodayRow {
  return { id: person.id, name: person.name, village: person.village };
}

export function todayRecord(person: Person): TodayRecord {
  return { ...todayRow(person), age: person.age, sex: person.sex };
}
