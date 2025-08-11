"use client";

import { useState, useCallback, useEffect } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isBefore, startOfDay, isSameDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { enUS } from "date-fns/locale";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: startOfWeek as any,
  getDay,
  locales: locales as any,
} as any);

const timeSlots = [
  "00:00-01:00","01:00-02:00","02:00-03:00","03:00-04:00","04:00-05:00","05:00-06:00",
  "06:00-07:00","07:00-08:00","08:00-09:00","09:00-10:00","10:00-11:00","11:00-12:00",
  "12:00-13:00","13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00",
  "18:00-19:00","19:00-20:00","20:00-21:00","21:00-22:00","22:00-23:00","23:00-00:00"
];

// Allow day styling on RBC
declare module "react-big-calendar" {
  interface CalendarProps {
    dayPropGetter?: (date: Date) => { className?: string; style?: React.CSSProperties };
    className?: string;
  }
}

interface CalendarProps { userId: string; }
interface Schedule {
  id: string; userId: string; date: Date; timeSlots: string[]; createdAt: Date; updatedAt: Date;
}
interface Booking {
  id: string; timeSlot: string; guestName: string; guestEmail: string; notes?: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELED"; createdAt: string;
}

export default function Calendar({ userId }: CalendarProps) {
  const router = useRouter();
  // Initialize with today's date selected
  const [selectedDate, setSelectedDate] = useState<Date | null>(startOfDay(new Date()));
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // bookings
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);

  const fetchSchedules = useCallback(async (date: Date) => {
    try {
      setIsLoading(true);
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await fetch(`/api/schedules?date=${formattedDate}&userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch schedules");
      const data = await response.json();
      if (data.length > 0 && data[0].timeSlots.length === 0) {
        // Treat an empty timeSlots schedule as no schedule
        setSchedules([]);
        setSelectedTimeSlots([]);
      } else {
        setSchedules(data);
        setSelectedTimeSlots(data.length > 0 ? data[0].timeSlots : []);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch your schedule", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const fetchBookings = useCallback(async (date: Date) => {
    try {
      setIsBookingsLoading(true);
      const formattedDate = format(date, "yyyy-MM-dd");
      const res = await fetch(`/api/bookings?userId=${userId}&date=${formattedDate}`);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data: Booking[] = await res.json();
      setBookings(data);
    } catch {
      toast({ title: "Error", description: "Failed to fetch bookings", variant: "destructive" });
    } finally {
      setIsBookingsLoading(false);
    }
  }, [userId]);

  const deleteBooking = async (bookingId: string) => {
    if (!selectedDate) return;
  const confirmed = typeof window !== 'undefined' ? window.confirm("Delete this booking and restore its slot?") : false;
  if (!confirmed) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
      toast({ title: "Deleted", description: "Booking removed and slot restored" });
      // Refresh bookings and schedules (slot restored)
      fetchBookings(selectedDate);
      fetchSchedules(selectedDate);
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete booking", variant: "destructive" });
    }
  };

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    const selected = startOfDay(slotInfo.start);
    setSelectedDate(selected);
    setIsFormOpen(true);
    setIsEditing(false);
    fetchSchedules(selected);
    fetchBookings(selected);
  }, [fetchSchedules, fetchBookings]);

  // Auto-fetch for today's date on mount
  useEffect(() => {
    if (selectedDate) {
      fetchSchedules(selectedDate);
      fetchBookings(selectedDate);
    }
  }, [selectedDate, fetchSchedules, fetchBookings]);

  const handleTimeSlotChange = (slot: string) => {
    setSelectedTimeSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const saveSchedule = async () => {
    if (!selectedDate) return;
    const today = startOfDay(new Date());
    const selectedDateStart = startOfDay(selectedDate);
    if (isBefore(selectedDateStart, today)) {
      toast({ title: "Cannot edit past dates", description: "You can only edit today's and future dates", variant: "destructive" });
      return;
    }
    try {
      setIsLoading(true);
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formattedDate, timeSlots: selectedTimeSlots, userId }),
      });
      if (!response.ok) throw new Error("Failed to save schedule");
      toast({ title: "Success", description: "Your schedule has been updated" });
      if (selectedTimeSlots.length === 0) {
        // Cleared schedule: show editor state as unscheduled
        setSchedules([]);
        setSelectedTimeSlots([]);
        setIsFormOpen(true);
        setIsEditing(true); // stay in editor for adding new slots quickly
      } else {
        setIsFormOpen(false);
        setIsEditing(false);
      }
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to save your schedule", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = () => {
    const today = startOfDay(new Date());
    const selectedDateStart = selectedDate ? startOfDay(selectedDate) : null;
    if (selectedDateStart && isBefore(selectedDateStart, today)) {
      toast({ title: "Cannot edit past dates", description: "You can only edit today's and future dates", variant: "destructive" });
      return;
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    if (selectedDate) fetchSchedules(selectedDate);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-2/3">
        <div className="rounded-[14px] shadow-lg p-4 border"
             style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
          {/* @ts-ignore */}
          <BigCalendar
            localizer={localizer}
            events={[]}
            views={["month"] as any}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            selectable
            onSelectSlot={handleSelectSlot}
            className="calendar-custom"
            dayPropGetter={(date: Date) => {
              const today = startOfDay(new Date());
              const isPast = isBefore(date, today);
              const isToday = isSameDay(date, today);
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              let backgroundColor = "transparent";
              if (isPast) backgroundColor = "color-mix(in srgb, var(--foreground) 6%, transparent)";
              if (isToday) backgroundColor = "color-mix(in srgb, var(--foreground) 12%, transparent)";
              if (isSelected) backgroundColor = "color-mix(in srgb, var(--foreground) 20%, transparent)";
              return {
                className: [
                  isPast ? "past-date" : "",
                  isToday ? "today-date" : "",
                  isSelected ? "selected-date" : "",
                ].filter(Boolean).join(" "),
                style: {
                  backgroundColor,
                  border: isSelected ? "1px solid color-mix(in srgb, var(--foreground) 35%, transparent)" : undefined,
                  borderRadius: 8,
                  cursor: "pointer",
                },
              };
            }}
          />
        </div>
      </div>

      {isFormOpen && selectedDate && (
        <div className="w-full md:w-1/3 rounded-[14px] shadow-lg p-6 border"
             style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
          <h2 className="text-xl font-semibold mb-4">
            {`Schedule for ${format(selectedDate, "MMMM d, yyyy")}`}
          </h2>

          {/* Booked list */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium">Booked</h3>
              <span className="text-sm">
                {isBookingsLoading ? "Loading..." : `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {bookings.length === 0 ? (
              <div className="p-3 border rounded-md"
                   style={{ borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}>
                No bookings for this date
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {bookings.map((b) => (
                  <div key={b.id} className="p-3 border rounded-md group"
                       style={{
                         background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
                         borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)",
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{b.timeSlot}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "var(--foreground)", color: "var(--background)" }}>
                        {b.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="text-sm mt-1">
                      {b.guestName} • <a className="underline" href={`mailto:${b.guestEmail}`}>{b.guestEmail}</a>
                    </div>
                    {b.notes ? <div className="text-sm mt-1">“{b.notes}”</div> : null}
                    <div className="mt-2 flex justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => deleteBooking(b.id)}
                        className="text-xs px-2 py-1 rounded-md border"
                        style={{ borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Availability view / editor */}
          {schedules.length > 0 && schedules[0].timeSlots.length > 0 && !isEditing ? (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Available Time Slots</h3>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
          {schedules[0].timeSlots.map((slot, index) => (
                    <div key={index} className="p-2 rounded-md"
                         style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
            <label>{slot} IST</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={startEditing}
                  className="px-4 py-2 rounded-md"
                  style={{ background: "var(--foreground)", color: "var(--background)" }}
                >
                  Edit Schedule
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Select Available Time Slots</h3>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {timeSlots.map((slot) => (
                    <div key={slot} className="flex items-center p-2 rounded-md"
                         style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}>
                      <input
                        type="checkbox"
                        id={slot}
                        checked={selectedTimeSlots.includes(slot)}
                        onChange={() => handleTimeSlotChange(slot)}
                        className="mr-2 h-5 w-5"
                      />
                      <label htmlFor={slot}>{slot} IST</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 border rounded-md"
                      style={{ borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSchedule}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-md disabled:opacity-50"
                      style={{ background: "var(--foreground)", color: "var(--background)" }}
                    >
                      {isLoading ? "Saving..." : (selectedTimeSlots.length === 0 ? "Clear Schedule" : "Save Schedule")}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEditing}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "var(--foreground)", color: "var(--background)" }}
                  >
                    {schedules.length === 0 ? "Create Schedule" : "Edit Schedule"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}