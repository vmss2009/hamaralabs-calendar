"use client";

import { format, isBefore, startOfDay, startOfWeek, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from "date-fns";
import { useEffect, useState, useCallback, useMemo, use } from "react";
import { toast } from "@/components/ui/use-toast";

// Utility function to convert 24-hour format to 12-hour format
function formatTimeTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Public Calendar Component (similar to ModernCalendar but for public booking)
interface PublicCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  schedules: Schedule[];
  userName: string;
}

function PublicCalendar({ selectedDate, onDateSelect, schedules, userName }: PublicCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = startOfDay(new Date());
  
  const monthStart = startOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = startOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
  
  // Get all days to display (including previous/next month days to fill the grid)
  const days = eachDayOfInterval({ 
    start: calendarStart, 
    end: new Date(calendarEnd.getTime() + 6 * 24 * 60 * 60 * 1000) 
  });
  
  const previousMonth = () => setViewDate(subMonths(viewDate, 1));
  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  const goToToday = () => {
    setViewDate(new Date());
    onDateSelect(today);
  };
  
  // Check if a date has available schedules
  const hasAvailableSlots = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const schedule = schedules.find(s => {
      const scheduleDate = s.date instanceof Date ? s.date : new Date(s.date);
      return format(scheduleDate, 'yyyy-MM-dd') === dateStr;
    });
    return schedule && schedule.timeSlots && schedule.timeSlots.some(slot => slot.bookedSlots < slot.maxSlots);
  };
  
  // Get available slot count for a date
  const getAvailableSlotCount = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const schedule = schedules.find(s => {
      const scheduleDate = s.date instanceof Date ? s.date : new Date(s.date);
      return format(scheduleDate, 'yyyy-MM-dd') === dateStr;
    });
    if (!schedule) return 0;
    
    return schedule.timeSlots.reduce((count, slot) => {
      return count + (slot.maxSlots - slot.bookedSlots);
    }, 0);
  };
  
  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <div>
          <h1 className="text-3xl font-bold">
            {userName} Schedule
          </h1>
          <h2 className="text-xl font-medium mt-1">
            {format(viewDate, 'MMMM yyyy')}
          </h2>
          <p className="text-sm opacity-60 mt-1">
            Click on a date to view available time slots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            style={{ 
              borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)",
              background: "color-mix(in srgb, var(--foreground) 5%, transparent)"
            }}
          >
            Today
          </button>
          <div className="flex rounded-lg border overflow-hidden"
               style={{ borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}>
            <button
              onClick={previousMonth}
              className="px-3 py-1.5 hover:bg-opacity-20 transition-colors"
              style={{ background: "color-mix(in srgb, var(--foreground) 5%, transparent)" }}
            >
              ←
            </button>
            <button
              onClick={nextMonth}
              className="px-3 py-1.5 hover:bg-opacity-20 transition-colors border-l"
              style={{ 
                background: "color-mix(in srgb, var(--foreground) 5%, transparent)",
                borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)"
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
      
      {/* Days of week header */}
      <div className="grid grid-cols-7 mb-2">
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
          <div key={day} className="p-3 text-center">
            <div className="text-sm font-medium opacity-70">
              {day.slice(0, 3)}
            </div>
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, dayIdx) => {
          const isCurrentMonth = day.getMonth() === viewDate.getMonth();
          const isPast = isBefore(day, today);
          const isTodayDate = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasSlots = hasAvailableSlots(day);
          const availableCount = getAvailableSlotCount(day);
          
          return (
            <button
              key={dayIdx}
              onClick={() => onDateSelect(day)}
              disabled={isPast || !hasSlots}
              className={`
                relative h-20 p-2 rounded-lg transition-all duration-200
                flex flex-col items-center justify-center
                ${
                  !isCurrentMonth 
                    ? 'opacity-30' 
                    : isPast || !hasSlots
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:scale-105 hover:shadow-md cursor-pointer'
                }
              `}
              style={{
                background: isSelected
                  ? 'var(--foreground)'
                  : hasSlots
                    ? 'color-mix(in srgb, var(--foreground) 12%, transparent)'
                    : isTodayDate
                      ? 'color-mix(in srgb, var(--foreground) 8%, transparent)'
                      : 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                color: isSelected ? 'var(--background)' : 'var(--foreground)',
                border: isTodayDate && !isSelected 
                  ? '2px solid var(--foreground)' 
                  : '1px solid color-mix(in srgb, var(--foreground) 15%, transparent)',
              }}
            >
              {/* Date number */}
              <div className={`text-lg font-semibold ${
                isSelected ? 'text-current' : isTodayDate ? 'font-bold' : ''
              }`}>
                {format(day, 'd')}
              </div>
              
              {/* Available slots indicator */}
              {hasSlots && availableCount > 0 && (
                <div className="mt-1 flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full ${
                    isSelected 
                      ? 'bg-current opacity-70'
                      : 'bg-green-500'
                  }`} />
                  <div className={`text-xs mt-0.5 ${
                    isSelected ? 'text-current opacity-80' : 'opacity-70'
                  }`}>
                    {availableCount === 1 ? '1 slot' : `${availableCount} slots`}
                  </div>
                </div>
              )}
              
              {/* Today indicator */}
              {isTodayDate && (
                <div className="absolute top-1 right-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isSelected ? 'bg-current' : 'bg-blue-500'
                  }`} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 px-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2" 
               style={{ borderColor: 'var(--foreground)' }} />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" 
               style={{ background: 'var(--foreground)' }} />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded flex items-center justify-center" 
               style={{ background: 'color-mix(in srgb, var(--foreground) 12%, transparent)' }}>
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span>Available</span>
        </div>
      </div>
    </div>
  );
}

interface SchedulePageProps {
  params: Promise<{ username: string }>;
}
interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  maxSlots: number;
  bookedSlots: number;
}

interface Schedule {
  id: string;
  userId: string;
  date: Date;
  timeSlots: TimeSlot[];
  createdAt: Date;
  updatedAt: Date;
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { username } = use(params);

  const [user, setUser] = useState<{ username: string; name?: string; isPublic: boolean } | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Start on today's date
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => startOfDay(new Date()));

  // booking UI state
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
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
          .map((s: { id: string; userId: string; date: string; timeSlots: TimeSlot[]; createdAt: string; updatedAt: string }) => ({
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

  const handleDateSelect = useCallback(
    (date: Date) => {
      const picked = startOfDay(date);
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
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          guestName,
          guestEmail,
          notes,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || "Failed to book");
      }
      toast({ title: "Booked!", description: `You're in for ${formatTimeTo12Hour(selectedSlot.startTime)}-${formatTimeTo12Hour(selectedSlot.endTime)}.` });

      // refresh schedules so slot disappears
  const schedulesResponse = await fetch(`/api/schedules/public/${username}?leadMinutes=30`);
      const schedulesData = await schedulesResponse.json();
      const formatted = schedulesData
        .map((s: { id: string; userId: string; date: string; timeSlots: TimeSlot[]; createdAt: string; updatedAt: string }) => ({
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An unknown error occurred";
      toast({ title: "Couldn't book", description: message, variant: "destructive" });
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
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <div className="w-full lg:w-2/3">
          <div className="rounded-xl shadow-lg p-6 border"
               style={{ background: "var(--background)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
            <PublicCalendar 
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              schedules={schedules}
              userName={user.name || username}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-1/3">
          <div className="rounded-xl shadow-lg p-6 border"
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
                  <p className="text-sm">
                    {selectedSchedule.timeSlots.length} time slot{selectedSchedule.timeSlots.length === 1 ? '' : 's'} available
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedSchedule.timeSlots.map((slot, index) => {
                    const availableCount = slot.maxSlots - slot.bookedSlots;
                    return (
                      <div
                        key={index}
                        className="p-3 rounded-md border flex items-center justify-between"
                        style={{ 
                          background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
                          borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)",
                          opacity: availableCount > 0 ? 1 : 0.5
                        }}
                      >
                        <div>
                          <div className="font-medium">{formatTimeTo12Hour(slot.startTime)}-{formatTimeTo12Hour(slot.endTime)}</div>
                          <div className="text-xs opacity-70">
                            {availableCount}/{slot.maxSlots} available
                          </div>
                        </div>
                        <button
                          className="px-3 py-1 text-sm rounded-md disabled:opacity-50"
                          style={{ background: "var(--foreground)", color: "var(--background)" }}
                          onClick={() => setSelectedSlot(slot)}
                          disabled={availableCount === 0}
                        >
                          {availableCount > 0 ? 'Book' : 'Full'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Booking form */}
                {selectedSlot && (
                  <div className="mt-6 border-t pt-4"
                       style={{ borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
                    <h3 className="font-semibold mb-3">
                      Book {formatTimeTo12Hour(selectedSlot.startTime)}-{formatTimeTo12Hour(selectedSlot.endTime)}
                    </h3>
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