import { NextResponse } from 'next/server';

// Google Calendar iCal URL (derived from embed URL)
const ICAL_URL = 'https://calendar.google.com/calendar/ical/7c2c8e26b783242015b19bc6785d1d302b5509b6701458f414490a3b2635ec56%40group.calendar.google.com/public/basic.ics';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

function parseICalDate(dateStr: string): Date {
  // Handle both DATE and DATE-TIME formats
  // DATE: 20260127
  // DATE-TIME: 20260127T143000Z or 20260127T143000
  if (dateStr.length === 8) {
    // Date only format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  } else {
    // DateTime format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15)) || 0;

    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }
}

function parseICal(icalData: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icalData.replace(/\r\n /g, '').split(/\r?\n/);

  let currentEvent: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.title && currentEvent.start) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);

        // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20260127)
        const keyBase = key.split(';')[0];

        switch (keyBase) {
          case 'UID':
            currentEvent.id = value;
            break;
          case 'SUMMARY':
            currentEvent.title = value;
            break;
          case 'DTSTART':
            currentEvent.start = parseICalDate(value).toISOString();
            break;
          case 'DTEND':
            currentEvent.end = parseICalDate(value).toISOString();
            break;
          case 'DESCRIPTION':
            currentEvent.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
            break;
          case 'LOCATION':
            currentEvent.location = value.replace(/\\,/g, ',');
            break;
        }
      }
    }
  }

  return events;
}

export async function GET() {
  try {
    const response = await fetch(ICAL_URL, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }

    const icalData = await response.text();
    const events = parseICal(icalData);

    // Filter to upcoming events (next 14 days) and sort by date
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const upcomingEvents = events
      .filter(event => {
        const eventDate = new Date(event.start);
        return eventDate >= now && eventDate <= twoWeeksLater;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 10); // Limit to 10 events

    return NextResponse.json({ events: upcomingEvents });
  } catch (error) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', events: [] },
      { status: 500 }
    );
  }
}
