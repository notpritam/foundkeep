// The home screen's greeting (Pritam, 2026-10-03): "Good morning, Lena" was the cleanest; let it
// vary — the time of day, "Hey Pritam", "Welcome back, Pritam" — but deterministically: the same
// part of the same day always gets the same greeting (no flicker between visits), and a new
// part of the day may bring a new one. It names only the first name, and never runs past one
// line: if a greeting with the name would be too long, a shorter one is used, then none.
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
type Make = (name: string) => string;

/** The greetings for each part of the day; `name` is the first name, '' when there is none. */
export const GREETINGS: Record<DayPart, Make[]> = {
  morning: [n => (n ? `Good morning, ${n}` : 'Good morning'), n => (n ? `Morning, ${n}` : 'Morning'), n => (n ? `Hey ${n}` : 'Hey there'), n => (n ? `Welcome back, ${n}` : 'Welcome back')],
  afternoon: [n => (n ? `Good afternoon, ${n}` : 'Good afternoon'), n => (n ? `Hey ${n}` : 'Hey there'), n => (n ? `Welcome back, ${n}` : 'Welcome back'), n => (n ? `Hello, ${n}` : 'Hello')],
  evening: [n => (n ? `Good evening, ${n}` : 'Good evening'), n => (n ? `Evening, ${n}` : 'Evening'), n => (n ? `Hey ${n}` : 'Hey there'), n => (n ? `Welcome back, ${n}` : 'Welcome back')],
  night: [n => (n ? `Still up, ${n}?` : 'Still up?'), n => (n ? `Hey ${n}` : 'Hey there'), n => (n ? `Welcome back, ${n}` : 'Welcome back')],
};
/** About as many characters as fit on one line of the greeting, on the narrowest phones. */
export const MAX = 22;

export const dayPart = (date: Date): DayPart => {
  const hour = date.getHours();
  return hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
};

/** The greeting for `name` at `date`: picked from the day and its part, so it holds steady. */
export function greeting(fullName: string | null | undefined, date = new Date()): string {
  const part = dayPart(date), choices = GREETINGS[part];
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}:${part}`;
  const hash = [...day].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 17);
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  // The chosen greeting with the name; if that's too long, the shortest greeting with it; then without.
  const picked = choices[hash % choices.length];
  if (first && picked(first).length <= MAX) return picked(first);
  const shortest = choices.map(make => make(first)).filter(text => first && text.length <= MAX).sort((a, b) => a.length - b.length)[0];
  return shortest ?? picked('');
}
