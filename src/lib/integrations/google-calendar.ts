import { addDays, addMinutes, formatISO, startOfDay, startOfHour, subDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { sendDiscoveryFollowupAndMappingEmail } from "@/lib/services/discovery-workflow";
import { logEvent } from "@/lib/services/event-log";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
  }>;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
};

async function getConnectedGoogleAccount() {
  return prisma.googleAccount.findFirst({
    orderBy: { id: "asc" }
  });
}

async function getGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Configuration Google Calendar incomplète.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Authentification Google impossible (${response.status}) : ${detail}`);
  }

  const json = (await response.json()) as GoogleTokenResponse;
  return json.access_token;
}

async function listCalendarEvents(params: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events`
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("showDeleted", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("timeMin", params.timeMin);
  url.searchParams.set("timeMax", params.timeMax);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Lecture agenda Google impossible (${response.status}) : ${detail}`);
  }

  const json = (await response.json()) as { items?: GoogleCalendarEvent[] };
  return json.items ?? [];
}

async function createCalendarEvent(params: {
  accessToken: string;
  calendarId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
}) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        start: {
          dateTime: params.startDateTime
        },
        end: {
          dateTime: params.endDateTime
        }
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Création événement Google impossible (${response.status}) : ${detail}`);
  }

  return (await response.json()) as GoogleCalendarEvent;
}

function isCandidateEmail(email: string, franchiseEmail: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === franchiseEmail.trim().toLowerCase()) return false;
  return true;
}

function isFranchiseSideEmail(email: string, franchiseEmail: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith("@atome3d.com") || normalized === franchiseEmail.trim().toLowerCase();
}

function getEventCandidateEmail(event: GoogleCalendarEvent, franchiseEmail: string) {
  const attendeeEmail = event.attendees
    ?.map((attendee) => attendee.email?.trim().toLowerCase() || "")
    .find((email) => isCandidateEmail(email, franchiseEmail));

  return attendeeEmail || null;
}

function getFranchiseInterlocutorName(params: {
  event: GoogleCalendarEvent;
  franchiseEmail: string;
  candidateEmail: string;
  fallbackName?: string | null;
}) {
  const { event, franchiseEmail, candidateEmail, fallbackName } = params;
  const normalizedCandidateEmail = candidateEmail.trim().toLowerCase();

  const internalAttendee = event.attendees?.find((attendee) => {
    const email = attendee.email?.trim().toLowerCase() || "";
    return email !== normalizedCandidateEmail && isFranchiseSideEmail(email, franchiseEmail);
  });

  if (internalAttendee?.displayName?.trim()) {
    return internalAttendee.displayName.trim();
  }

  const organizerEmail = event.organizer?.email?.trim().toLowerCase() || "";
  if (organizerEmail && organizerEmail !== normalizedCandidateEmail && isFranchiseSideEmail(organizerEmail, franchiseEmail)) {
    return event.organizer?.displayName?.trim() || event.organizer?.email || fallbackName || "Atome3D";
  }

  return fallbackName || "Atome3D";
}

function getEventDates(event: GoogleCalendarEvent) {
  const startValue = event.start?.dateTime || event.start?.date;
  const endValue = event.end?.dateTime || event.end?.date;

  if (!startValue || !endValue) {
    return null;
  }

  return {
    start: new Date(startValue),
    end: new Date(endValue)
  };
}

function sameDateTime(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function inferAppointmentType(
  event: GoogleCalendarEvent,
  fallbackStep: number,
  existingType?: string | null
) {
  const haystack = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();

  if (haystack.includes("journée découverte") || haystack.includes("journee decouverte")) {
    return "DISCOVERY_DAY";
  }

  if (haystack.includes("visio")) {
    return "VISIO_DECOUVERTE";
  }

  if (existingType === "DISCOVERY_DAY" || existingType === "VISIO_DECOUVERTE") {
    return existingType;
  }

  return fallbackStep >= 4 ? "DISCOVERY_DAY" : "VISIO_DECOUVERTE";
}

export async function getAvailability() {
  const connected = await getConnectedGoogleAccount();

  if (!connected) {
    const start = startOfHour(new Date());
    return Array.from({ length: 6 }, (_, index) => {
      const slotStart = addMinutes(start, (index + 1) * 120);
      return {
        start: slotStart,
        end: addMinutes(slotStart, 45)
      };
    });
  }

  const accessToken = await getGoogleAccessToken(connected.googleRefreshToken);
  const now = new Date();
  const events = await listCalendarEvents({
    accessToken,
    calendarId: connected.googleCalendarId,
    timeMin: formatISO(now),
    timeMax: formatISO(addDays(now, 14))
  });

  return events
    .map((event) => getEventDates(event))
    .filter((item): item is { start: Date; end: Date } => Boolean(item));
}

export async function createCalendarBooking(input: {
  candidateId: string;
  start: Date;
  end: Date;
}) {
  return {
    googleEventId: `manual-booking-${input.candidateId}-${input.start.toISOString()}`
  };
}

export async function createDipLegalDelayCalendarEvent(input: {
  candidateId: string;
  candidateName: string;
  city: string;
  deadline: Date;
}) {
  const connected = await getConnectedGoogleAccount();

  if (!connected) {
    throw new Error("Google Calendar n'est pas connecté.");
  }

  const existingLog = await prisma.eventLog.findFirst({
    where: {
      candidateId: input.candidateId,
      actionType: "DIP_LEGAL_DELAY_EVENT_CREATED"
    },
    orderBy: { createdAt: "desc" }
  });

  if (existingLog) {
    return existingLog.detailsJson as { googleEventId?: string; deadline?: string };
  }

  const accessToken = await getGoogleAccessToken(connected.googleRefreshToken);
  const start = startOfDay(input.deadline);
  const end = addMinutes(start, 30);
  const summary = `Fin délai DIP de ${input.candidateName} candidat ${input.city}`;
  const description = `Fin du délai légal de 20 jours du DIP pour ${input.candidateName} (${input.city}).`;

  const event = await createCalendarEvent({
    accessToken,
    calendarId: connected.googleCalendarId,
    summary,
    description,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString()
  });

  await logEvent({
    actionType: "DIP_LEGAL_DELAY_EVENT_CREATED",
    candidateId: input.candidateId,
    detailsJson: {
      googleEventId: event.id ?? null,
      deadline: input.deadline.toISOString(),
      calendarId: connected.googleCalendarId,
      summary
    }
  });

  return {
    googleEventId: event.id ?? null,
    deadline: input.deadline.toISOString()
  };
}

export async function syncGoogleCalendarVisios() {
  const connected = await getConnectedGoogleAccount();

  if (!connected) {
    return { synced: false, created: 0, updated: 0 };
  }

  const accessToken = await getGoogleAccessToken(connected.googleRefreshToken);
  const franchiseEmail = connected.googleCalendarId;
  const events = await listCalendarEvents({
    accessToken,
    calendarId: connected.googleCalendarId,
    timeMin: formatISO(subDays(new Date(), 14)),
    timeMax: formatISO(addDays(new Date(), 180))
  });

  let created = 0;
  let updated = 0;

  for (const event of events) {
    if (!event.id) continue;

    if (event.status === "cancelled") {
      const existing = await prisma.appointment.findFirst({
        where: { googleEventId: event.id },
        include: {
          candidate: {
            include: {
              assignedDev: true
            }
          }
        }
      });

      if (!existing || existing.status === "CANCELLED") {
        continue;
      }

      await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          status: "CANCELLED"
        }
      });

      const noteAuthorId =
        existing.candidate.assignedDevId ??
        (
          await prisma.user.findFirst({
            where: { role: { in: ["ADMIN", "DEV"] } },
            orderBy: { createdAt: "asc" }
          })
        )?.id;

      if (noteAuthorId) {
        const notePrefix =
          existing.appointmentType === "DISCOVERY_DAY"
            ? "Journée découverte annulée"
            : "RDV visio annulé";

        await prisma.noteAdmin.create({
          data: {
            candidateId: existing.candidateId,
            authorId: noteAuthorId,
            noteText: notePrefix
          }
        });
      }

      await logEvent({
        actionType: "CALENDAR_APPOINTMENT_CANCELLED",
        candidateId: existing.candidateId,
        userId: noteAuthorId,
        detailsJson: {
          appointmentType: existing.appointmentType,
          googleEventId: existing.googleEventId,
          startDatetime: existing.startDatetime.toISOString()
        }
      });

      updated += 1;
      continue;
    }

    const dates = getEventDates(event);
    if (!dates) continue;

    const candidateEmail = getEventCandidateEmail(event, franchiseEmail);
    if (!candidateEmail) continue;

    const candidate = await prisma.candidate.findFirst({
      where: {
        user: {
          email: {
            equals: candidateEmail,
            mode: "insensitive"
          }
        }
      },
      include: {
        assignedDev: true
      }
    });

    if (!candidate) continue;

    const existing = await prisma.appointment.findFirst({
      where: { googleEventId: event.id }
    });
    const appointmentType = inferAppointmentType(event, candidate.currentStep, existing?.appointmentType);

    if (existing) {
      const wasMoved =
        !sameDateTime(existing.startDatetime, dates.start) ||
        !sameDateTime(existing.endDatetime, dates.end);

      await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          candidateId: candidate.id,
          appointmentType,
          startDatetime: dates.start,
          endDatetime: dates.end,
          status: "CONFIRMED"
        }
      });

      if (wasMoved) {
        const noteAuthorId =
          candidate.assignedDevId ??
          (
            await prisma.user.findFirst({
              where: { role: { in: ["ADMIN", "DEV"] } },
              orderBy: { createdAt: "asc" }
            })
          )?.id;

        if (noteAuthorId) {
          const notePrefix =
            appointmentType === "DISCOVERY_DAY"
              ? "Journée découverte déplacée"
              : "RDV visio déplacé";

          await prisma.noteAdmin.create({
            data: {
              candidateId: candidate.id,
              authorId: noteAuthorId,
              noteText: `${notePrefix} au ${dates.start.toLocaleDateString("fr-FR")} à ${dates.start.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit"
              })}.`
            }
          });
        }

        await logEvent({
          actionType: "CALENDAR_APPOINTMENT_RESCHEDULED",
          candidateId: candidate.id,
          userId: noteAuthorId,
          detailsJson: {
            appointmentType,
            googleEventId: event.id,
            startDatetime: dates.start.toISOString()
          }
        });
      }

      updated += 1;
      continue;
    }

    await prisma.appointment.create({
      data: {
        candidateId: candidate.id,
        googleEventId: event.id,
        appointmentType,
        startDatetime: dates.start,
        endDatetime: dates.end,
        status: "CONFIRMED"
      }
    });

    const noteAuthorId =
      candidate.assignedDevId ??
      (
        await prisma.user.findFirst({
          where: { role: { in: ["ADMIN", "DEV"] } },
          orderBy: { createdAt: "asc" }
        })
      )?.id;

    if (noteAuthorId) {
      const interlocutorName = getFranchiseInterlocutorName({
        event,
        franchiseEmail,
        candidateEmail,
        fallbackName: candidate.assignedDev
          ? `${candidate.assignedDev.firstname} ${candidate.assignedDev.lastname}`
          : "Atome3D"
      });
      const notePrefix =
        appointmentType === "DISCOVERY_DAY" ? "Journée découverte prévue" : "RDV visio prévu";

      await prisma.noteAdmin.create({
        data: {
          candidateId: candidate.id,
          authorId: noteAuthorId,
          noteText: `${notePrefix} le ${dates.start.toLocaleDateString("fr-FR")} à ${dates.start.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
          })} avec ${interlocutorName}.`
        }
      });
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        currentStep:
          appointmentType === "DISCOVERY_DAY"
            ? candidate.currentStep < 4
              ? 4
              : candidate.currentStep
            : candidate.currentStep < 3
              ? 3
              : candidate.currentStep,
        lastActivityAt: new Date()
      }
    });

    created += 1;
  }

  return { synced: true, created, updated };
}

export async function runDiscoveryFollowupCron() {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      appointmentType: "DISCOVERY_DAY",
      status: "CONFIRMED",
      startDatetime: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });

  let sent = 0;

  for (const appointment of appointments) {
    const result = await sendDiscoveryFollowupAndMappingEmail({
      candidateId: appointment.candidateId,
      appointmentId: appointment.id
    });

    if (result.sent) {
      sent += 1;
    }
  }

  return { sent };
}
