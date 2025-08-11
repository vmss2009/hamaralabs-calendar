"use client";

import { useState, useCallback } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isBefore, startOfDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { enUS } from "date-fns/locale";

// Define the locales for date-fns
const locales = { "en-US": enUS };

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

interface CalendarProps {
  userId: string;
}

interface Schedule {
  id: string;
  userId: string;
  date: Date;
  timeSlots: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Booking {
  id: string;
  timeSlot: string;
  guestName: string;
  guestEmail: string;
  notes?: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELED";
  createdAt: string;
}

export default function Calendar({ userId }: CalendarProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // NEW: bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);

  // Fetch schedules for the selected date
  const fetchSchedules = useCallback(async (date: Date) => {
    try {
      setIsLoading(true);
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await fetch(`/api/schedules?date=${formattedDate}&userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch schedules");
      const data = await response.json();
      setSchedules(data);
      setSelectedTimeSlots(data.length > 0 ? data[0].timeSlots : []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast({ title: "Error", description: "Failed to fetch your schedule", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // NEW: fetch bookings for the date
  const fetchBookings = useCallback(async (date: Date) => {
    try {
      setIsBookingsLoading(true);
      const formattedDate = format(date, "yyyy-MM-dd");
      const res = await fetch(`/api/bookings?userId=${userId}&date=${formattedDate}`);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data: Booking[] = await res.json();
      setBookings(data);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to fetch bookings", variant: "destructive" });
    } finally {
      setIsBookingsLoading(false);
    }
  }, [userId]);

  // Handle date selection
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    const selected = startOfDay(slotInfo.start);
    setSelectedDate(selected);
    setIsFormOpen(true);
    setIsEditing(false);
    // Fetch both availability & bookings
    fetchSchedules(selected);
    fetchBookings(selected);
  }, [fetchSchedules, fetchBookings]);

  // Handle time slot selection
  const handleTimeSlotChange = (slot: string) => {
    setSelectedTimeSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  // Save schedule
  const saveSchedule = async () => {
    if (!selectedDate) return;

    const today = startOfDay(new Date());
    const selectedDateStart = startOfDay(selectedDate);

    // Check if the selected date is in the past
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

      setIsFormOpen(false);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({ title: "Error", description: "Failed to save your schedule", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Start editing a schedule
  const startEditing = () => {
    const today = startOfDay(new Date());
    const selectedDateStart = selectedDate ? startOfDay(selectedDate) : null;

    if (selectedDateStart && isBefore(selectedDateStart, today)) {
      toast({ title: "Cannot edit past dates", description: "You can only edit today's and future dates", variant: "destructive" });
      return;
    }

    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    if (selectedDate) fetchSchedules(selectedDate);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-2/3">
        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
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
              return {
                className: isBefore(date, today) ? "past-date" : "",
                style: { backgroundColor: isBefore(date, today) ? "#f3f4f6" : "white" },
              };
            }}
          />
        </div>
      </div>

      {isFormOpen && selectedDate && (
        <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-gray-800 text-xl font-semibold mb-4">
            Schedule for {format(selectedDate, "MMMM d, yyyy")}
          </h2>

          {/* Booked list (owner view) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium">Booked</h3>
              <span className="text-sm text-gray-600">
                {isBookingsLoading ? "Loading..." : `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {bookings.length === 0 ? (
              <div className="p-3 border rounded-md text-gray-500">No bookings for this date</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {bookings.map((b) => (
                  <div key={b.id} className="p-3 border rounded-md bg-emerald-50">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{b.timeSlot}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        {b.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="text-sm mt-1">
                      {b.guestName} • <a className="underline" href={`mailto:${b.guestEmail}`}>{b.guestEmail}</a>
                    </div>
                    {b.notes ? <div className="text-sm text-gray-700 mt-1">“{b.notes}”</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Availability view / editor (existing logic) */}
          {schedules.length > 0 && !isEditing ? (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Available Time Slots</h3>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {schedules[0].timeSlots.map((slot, index) => (
                    <div key={index} className="p-2 bg-blue-50 rounded-md">
                      <label className="text-gray-800">{slot}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={startEditing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                    <div key={slot} className="flex items-center p-2 hover:bg-gray-50 rounded-md">
                      <input
                        type="checkbox"
                        id={slot}
                        checked={selectedTimeSlots.includes(slot)}
                        onChange={() => handleTimeSlotChange(slot)}
                        className="mr-2 h-5 w-5 text-blue-600"
                      />
                      <label htmlFor={slot} className="text-gray-800">{slot}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {isEditing && (
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 border rounded-md hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveSchedule}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}