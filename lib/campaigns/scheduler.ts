// Distributes leads across working hours with random jitter

export function generateScheduledTimes(
  count: number,
  dailyCap: number,
  windowStartHour: number,
  windowEndHour: number,
  startFrom: Date = new Date()
): Date[] {
  const times: Date[] = [];
  const windowMinutes = (windowEndHour - windowStartHour) * 60;
  if (windowMinutes <= 0) throw new Error("Invalid time window");

  let day = 0;
  let countOnDay = 0;

  // Start from next working slot if already past window today
  const now = new Date(startFrom);
  const currentHour = now.getHours() + now.getMinutes() / 60;
  if (currentHour >= windowEndHour) day = 1; // start tomorrow

  for (let i = 0; i < count; i++) {
    if (countOnDay >= dailyCap) {
      day++;
      countOnDay = 0;
    }

    // Base date = start of window on `day`
    const base = new Date(now);
    base.setDate(base.getDate() + day);
    base.setHours(windowStartHour, 0, 0, 0);

    // Skip weekends
    while (base.getDay() === 0 || base.getDay() === 6) {
      base.setDate(base.getDate() + 1);
    }

    // Random offset within the window + ±3 min micro-jitter
    const randomOffset = Math.floor(Math.random() * windowMinutes);
    const jitter = Math.floor(Math.random() * 6) - 3; // -3 to +3 min
    const totalMinutes = randomOffset + jitter;

    const scheduled = new Date(base.getTime() + totalMinutes * 60 * 1000);
    times.push(scheduled);
    countOnDay++;
  }

  return times;
}

export function pickAccount(
  accountIds: string[],
  usedToday: Map<string, number>,
  dailyCap: number
): string | null {
  for (const id of accountIds) {
    const used = usedToday.get(id) ?? 0;
    if (used < dailyCap) return id;
  }
  return null;
}
