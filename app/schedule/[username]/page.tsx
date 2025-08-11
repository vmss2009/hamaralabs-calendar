"use client";

import { format, isBefore, startOfDay } from "date-fns";
import { Calendar as BigCalendar, dateFnsLocalizer, Event } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { parse, startOfWeek, getDay } from "date-fns";
import { enUS } from 'date-fns/locale';
import { useEffect, useState, use, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";

// Define the locales for date-fns
const locales = {
  "en-US": enUS,
};

// Configure the localizer
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: startOfWeek as any,
  getDay,
  locales: locales as any,
} as any);

// Define the time slots
const timeSlots = [
  "00:00-01:00",
  "01:00-02:00",
  "02:00-03:00",
  "03:00-04:00",
  "04:00-05:00",
  "05:00-06:00",
  "06:00-07:00",
  "07:00-08:00",
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
  "19:00-20:00",
  "20:00-21:00",
  "21:00-22:00",
  "22:00-23:00",
  "23:00-00:00"
];

interface SchedulePageProps {
  params: Promise<{
    username: string;
  }>;
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
  const resolvedParams = use(params);
  const username = resolvedParams.username;
  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");

  
  // Get today's date (start of day)
  const today = startOfDay(new Date());
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data
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
        
        // Fetch schedules
        const schedulesResponse = await fetch(`/api/schedules/public/${username}`);
        if (!schedulesResponse.ok) {
          throw new Error("Failed to fetch schedules");
        }
        const schedulesData = await schedulesResponse.json();
        
        // Convert date strings to Date objects and filter out past dates
        const formattedSchedules = schedulesData
          .map((schedule: any) => ({
            ...schedule,
            date: new Date(schedule.date),
            createdAt: new Date(schedule.createdAt),
            updatedAt: new Date(schedule.updatedAt)
          }))
          .filter((schedule: Schedule) => !isBefore(schedule.date, today));
        
        setSchedules(formattedSchedules);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [username]);

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

      // Refresh the schedule list so the slot disappears
      const schedulesResponse = await fetch(`/api/schedules/public/${username}`);
      const schedulesData = await schedulesResponse.json();
      const formatted = schedulesData
        .map((s: any) => ({ ...s, date: new Date(s.date), createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) }))
        .filter((s: Schedule) => !isBefore(s.date, today));
      setSchedules(formatted);

      // Reset form
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
  
  // Handle date selection
  const handleSelectSlot = useCallback((slotInfo: any) => {
    const selectedDate = slotInfo.start;
    
    // Check if the selected date is in the past
    if (isBefore(selectedDate, today)) {
      toast({
        title: "Cannot view past dates",
        description: "You can only view availability for today and future dates.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedDate(selectedDate);
    
    // Find schedule for the selected date
    const schedule = schedules.find(
      (s) => format(s.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    );
    
    setSelectedSchedule(schedule || null);
  }, [schedules, today]);
  
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">{error}</div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">User not found</div>
      </div>
    );
  }
  
  // Convert schedules to events for the calendar
  const events: CalendarEvent[] = schedules.map((schedule: Schedule) => {
    return {
      id: schedule.id,
      title: "Available",
      start: schedule.date,
      end: schedule.date,
      timeSlots: schedule.timeSlots,
    };
  });
  
  return (
    <div className="container mx-auto py-8 px-4 text-black">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-2/3">
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <h1 className="text-3xl font-bold mb-2 text-black">{user.name} Schedule</h1>

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
              dayPropGetter={(date: Date) => {
                const isPastDate = isBefore(date, today);
                return {
                  style: {
                    cursor: isPastDate ? "default" : "pointer",
                    backgroundColor: isPastDate ? "#f3f4f6" : "white",
                  },
                  className: isPastDate ? "past-date" : "",
                };
              }}
              eventPropGetter={(event: Event) => ({
                style: {
                  backgroundColor: "#4f46e5",
                  borderRadius: "4px",
                  width: "90%",
                  margin: "0 auto",
                  color: "#fff",
                },
              })}
              components={{
                event: ({ event }: { event: CalendarEvent }) => (
                  <div className="p-1" onClick={() => handleSelectSlot(event)}>
                    <div className="font-semibold text-black">{event.title}</div>
                    <div className="text-xs text-black">
                      {event.timeSlots?.length} time slots available
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </div>

        {/* Side panel for viewing & booking time slots */}
        <div className="w-full md:w-1/3">
          <div className="bg-white p-4 rounded-lg shadow-md text-black">
            <h2 className="text-xl font-semibold mb-4 text-black">
              {selectedDate
                ? `Available Time Slots for ${format(selectedDate, "MMMM d, yyyy")}`
                : "Select a date to view available time slots"}
            </h2>

            {selectedDate && isBefore(selectedDate, today) ? (
              <div className="text-center py-8 text-black">
                No time slots available for past dates
              </div>
            ) : selectedSchedule ? (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-black">
                    {selectedSchedule.timeSlots.length} time slots available
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedSchedule.timeSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-between"
                    >
                      <div className="font-medium text-black">{slot}</div>
                      <button
                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        onClick={() => setSelectedSlot(slot)}
                      >
                        Book
                      </button>
                    </div>
                  ))}
                </div>

                {/* Booking form */}
                {selectedSlot && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="font-semibold text-black mb-3">
                      Book {selectedSlot}
                    </h3>
                    <div className="space-y-3">
                      <input
                        className="w-full border rounded-md p-2 text-black"
                        placeholder="Your name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                      <input
                        className="w-full border rounded-md p-2 text-black"
                        placeholder="Your email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                      />
                      <textarea
                        className="w-full border rounded-md p-2 text-black"
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          className="px-4 py-2 border rounded-md hover:bg-gray-100 text-black"
                          onClick={() => setSelectedSlot(null)}
                          disabled={isBooking}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
              <div className="text-center py-8 text-black">
                No time slots available for this date
              </div>
            ) : (
              <div className="text-center py-8 text-black">
                Click on a date in the calendar to view available time slots
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 