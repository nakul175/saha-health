export function todayRow(person) {
    return { id: person.id, name: person.name, village: person.village };
}
export function todayRecord(person) {
    return { ...todayRow(person), age: person.age, sex: person.sex };
}
