import { addMinutes, startOfHour } from "date-fns";

export async function getAvailability() {
  const start = startOfHour(new Date());
  return Array.from({ length: 6 }, (_, index) => {
    const slotStart = addMinutes(start, (index + 1) * 120);
    return {
      start: slotStart,
      end: addMinutes(slotStart, 45)
    };
  });
}

export async function createCalendarBooking(input: {
  candidateId: string;
  start: Date;
  end: Date;
}) {
  return {
    googleEventId: `mock-event-${input.candidateId}-${input.start.toISOString()}`
  };
}
