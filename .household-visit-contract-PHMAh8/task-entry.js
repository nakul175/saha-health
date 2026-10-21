// SAHA-040: local deterministic navigation only. No task execution or authority.
export const TASK_ENTRY_MAX_LENGTH = 160;
export const TASK_ENTRY_CATALOGUE = [
    { intent: 'assigned-records', title: 'Open assigned records', phrases: ['today', 'open today', 'assigned records', 'show my assigned records'], steps: ['Sign in with your ASHA account.', 'Choose an assigned person in Today.', 'Check the person’s record reference before continuing.'] },
    { intent: 'routine-review', title: 'Review a routine visit', phrases: ['review routine visit', 'review a routine visit', 'open routine visit'], steps: ['Sign in with your ASHA account.', 'Choose the assigned person in Today and check their record reference.', 'Select Review routine visit. Opening it creates no visit; starting or saving requires your explicit action.'] },
];
const limitation = 'Only the listed navigation shortcuts are supported. No prescription, payment, patient chat or external action is performed. Use the existing care workflow and correct role for other requests.';
export function parseTaskEntry(input) {
    if (typeof input !== 'string' || input.length > TASK_ENTRY_MAX_LENGTH || !/^[\x20-\x7e]*$/.test(input))
        return { kind: 'refused', reason: 'invalid', message: limitation };
    const phrase = input.trim().toLowerCase().replace(/ +/g, ' ');
    const task = TASK_ENTRY_CATALOGUE.find(task => task.phrases.includes(phrase));
    if (!task)
        return { kind: 'refused', reason: 'unsupported', message: limitation };
    return { kind: 'navigation', intent: task.intent, title: task.title, href: '/today', steps: task.steps };
}
