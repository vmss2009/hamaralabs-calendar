"use client";

import { format, isBefore, startOfDay } from "date-fns";
import { Calendar as BigCalendar, dateFnsLocalizer, Event } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useEffect, useState, useCallback, useMemo, use } from "react";
import { toast } from "@/components/ui/use-toast";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: startOfWeek as any,
  getDay,
  locales: locales as any,
} as any);

interface SchedulePageProps {
  params: Promise<{ username: string }>;
}
interface Schedule {
  id: string;
  userId: string;
  date: Date;
  timeSlots: string[];
  createdAt: Date;
  updatedAt: Date;
}
interface CalendarEvent extends Event {
  timeSlots?: string[];
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { username } = use(params);

  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // booking UI state
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Stable reference to today's start (prevents infinite effect loops)
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userResponse = await fetch(`/api/users/${username}`);
        if (!userResponse.ok) {
          if (userResponse.status === 404) {
            setError("User not found");
            return;
          }
          throw new Error("Failed to fetch user data");
        }
        const userData = await userResponse.json();
        setUser(userData);
        // Enforce visibility at UI level
        if (userData && userData.isPublic === false) {
          setError("This user's schedule is currently private.");
          return;
        }

        const schedulesResponse = await fetch(`/api/schedules/public/${username}?leadMinutes=30`);
        if (!schedulesResponse.ok) throw new Error("Failed to fetch schedules");
        const schedulesData = await schedulesResponse.json();

        const formatted = schedulesData
          .map((s: any) => ({
            ...s,
            date: new Date(s.date),
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          }))
          // Remove past dates and any schedule that has zero timeSlots (treat as unscheduled)
          .filter((s: Schedule) => !isBefore(s.date, today) && s.timeSlots && s.timeSlots.length > 0);

        setSchedules(formatted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username, today]);

  // Set today's date initially (once)
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(today);
    }
  }, [selectedDate, today]);

  // Derive the schedule for the selected date
  const selectedSchedule = useMemo(() => {
    if (!selectedDate) return null;
    const match = schedules.find(
      (s) =>
        format(s.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd") &&
        s.timeSlots &&
        s.timeSlots.length > 0
    );
    return match ?? null;
  }, [schedules, selectedDate]);

  const handleSelectSlot = useCallback(
    (slotInfo: any) => {
      const picked = slotInfo.start;
      if (isBefore(picked, today)) {
        toast({
          title: "Cannot view past dates",
          description: "You can only view availability for today and future dates.",
          variant: "destructive",
        });
        return;
      }
      setSelectedDate(picked);
    },
    [today]
  );

  const events: CalendarEvent[] = schedules
    .filter((s) => s.timeSlots && s.timeSlots.length > 0)
    .map((schedule: Schedule) => ({
      id: schedule.id,
      title: "Available",
      start: schedule.date,
      end: schedule.date,
      timeSlots: schedule.timeSlots,
    }));

  async function submitBooking() {
    if (!selectedDate || !selectedSlot) return;
    try {
      setIsBooking(true);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          date: format(selectedDate, "yyyy-MM-dd"),
          timeSlot: selectedSlot,
          guestName,
          guestEmail,
          notes,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || "Failed to book");
      }
      toast({ title: "Booked!", description: `You’re in for ${selectedSlot}.` });

      // refresh schedules so slot disappears
  const schedulesResponse = await fetch(`/api/schedules/public/${username}?leadMinutes=30`);
      const schedulesData = await schedulesResponse.json();
      const formatted = schedulesData
        .map((s: any) => ({
          ...s,
          date: new Date(s.date),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }))
        .filter((s: Schedule) => !isBefore(s.date, today) && s.timeSlots && s.timeSlots.length > 0);
      setSchedules(formatted);

      setSelectedSlot(null);
      setGuestName("");
      setGuestEmail("");
      setNotes("");
    } catch (e: any) {
      toast({ title: "Couldn’t book", description: e.message, variant: "destructive" });
    } finally {
      setIsBooking(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div>{error}</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div>User not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Calendar */}
        <div className="w-full md:w-2/3">
          <div className="rounded-[14px] shadow-lg p-4 border"
               style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
            <h1 className="text-3xl font-bold mb-2">{user.name} Schedule</h1>

            {/* @ts-ignore */}
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              selectable
              onSelectSlot={handleSelectSlot}
              className="calendar-custom"
              views={["month"] as any}
              date={(selectedDate || today) as Date}
              dayPropGetter={(date: Date) => {
                const isPastDate = isBefore(startOfDay(date), today);
                const isToday = format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                const isSelected = !!selectedDate && format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                return {
                  style: {
                    cursor: isPastDate ? "default" : "pointer",
                    backgroundColor: isSelected
                      ? "color-mix(in srgb, var(--foreground) 14%, transparent)"
                      : isPastDate
                      ? "color-mix(in srgb, var(--foreground) 6%, transparent)"
                      : "transparent",
                    outline: isToday ? "2px solid color-mix(in srgb, var(--foreground) 40%, transparent)" : "none",
                    outlineOffset: isToday ? "-2px" : undefined,
                  },
                  className: isPastDate ? "past-date" : isSelected ? "selected-date" : isToday ? "today-date" : "",
                };
              }}
              eventPropGetter={() => ({
                style: {
                  backgroundColor: "var(--foreground)",
                  color: "var(--background)",
                  borderRadius: 6,
                  width: "90%",
                  margin: "0 auto",
                },
              })}
              components={{
                event: ({ event }: { event: CalendarEvent }) => (
                  <div className="p-1" onClick={() => handleSelectSlot(event)}>
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-xs">{event.timeSlots?.length} time slots available</div>
                  </div>
                ),
              }}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full md:w-1/3">
          <div className="rounded-[14px] shadow-lg p-4 border"
               style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
            <h2 className="text-xl font-semibold mb-4">
              {selectedDate
                ? `Available Time Slots for ${format(selectedDate, "MMMM d, yyyy")}`
                : "Select a date to view available time slots"}
            </h2>

            {selectedDate && isBefore(selectedDate, today) ? (
              <div className="text-center py-8">No time slots available for past dates</div>
            ) : selectedSchedule ? (
              <div>
                <div className="mb-4">
                  <p className="text-sm">{selectedSchedule.timeSlots.length} slots available</p>
                </div>

                <div className="space-y-2">
          {selectedSchedule.timeSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-md border flex items-center justify-between"
                      style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
                               borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}
                    >
            <div className="font-medium">{slot} IST</div>
                      <button
                        className="px-3 py-1 text-sm rounded-md"
                        style={{ background: "var(--foreground)", color: "var(--background)" }}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        Book
                      </button>
                    </div>
                  ))}
                </div>

                {/* Booking form */}
                {selectedSlot && (
                  <div className="mt-6 border-t pt-4"
                       style={{ borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
                    <h3 className="font-semibold mb-3">Book {selectedSlot}</h3>
                    <div className="space-y-3">
                      <input
                        className="w-full border rounded-md p-2"
                        style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}
                        placeholder="Your name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                      <input
                        className="w-full border rounded-md p-2"
                        style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}
                        placeholder="Your email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                      />
                      <textarea
                        className="w-full border rounded-md p-2"
                        style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          className="px-4 py-2 border rounded-md"
                          style={{ borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                          onClick={() => setSelectedSlot(null)}
                          disabled={isBooking}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-4 py-2 rounded-md disabled:opacity-50"
                          style={{ background: "var(--foreground)", color: "var(--background)" }}
                          onClick={submitBooking}
                          disabled={isBooking || !guestName || !guestEmail}
                        >
                          {isBooking ? "Booking..." : "Confirm Booking"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedDate ? (
              <div className="text-center py-8">No time slots available for this date</div>
            ) : (
              <div className="text-center py-8">Click on a date in the calendar to view available time slots</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}