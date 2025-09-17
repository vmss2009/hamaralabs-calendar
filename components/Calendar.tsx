"use client";

import { useState, useCallback, useEffect } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isBefore, startOfDay, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getWeek, isToday } from "date-fns";
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

interface TimeSlot {
  id?: string;
  startTime: string;
  endTime: string;
  maxSlots: number;
  bookedSlots: number;
}

// Replication Calendar Component
interface ReplicationCalendarProps {
  selectedDates: string[];
  onDateToggle: (dateStr: string) => void;
  currentDate: Date | null;
}

function ReplicationCalendar({ selectedDates, onDateToggle, currentDate }: ReplicationCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());
  
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Start on Sunday
  const calendarEnd = addMonths(monthEnd, 0);
  
  const days = eachDayOfInterval({ start: calendarStart, end: monthEnd });
  
  const previousMonth = () => setViewDate(subMonths(viewDate, 1));
  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  
  const today = startOfDay(new Date());
  const currentDateStr = currentDate ? format(currentDate, 'yyyy-MM-dd') : '';
  
  return (
    <div className="p-3">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <button 
          onClick={previousMonth}
          className="p-1 rounded hover:bg-opacity-20"
          style={{ background: "color-mix(in srgb, var(--foreground) 10%, transparent)" }}
        >
          ←
        </button>
        <h3 className="text-sm font-medium">
          {format(viewDate, 'MMMM yyyy')}
        </h3>
        <button 
          onClick={nextMonth}
          className="p-1 rounded hover:bg-opacity-20"
          style={{ background: "color-mix(in srgb, var(--foreground) 10%, transparent)" }}
        >
          →
        </button>
      </div>
      
      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-xs text-center py-1 font-medium opacity-70">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isSelected = selectedDates.includes(dayStr);
          const isPast = isBefore(day, today);
          const isCurrentMonth = day.getMonth() === viewDate.getMonth();
          const isCurrentDate = dayStr === currentDateStr;
          const isTodayDate = isToday(day);
          
          return (
            <button
              key={dayStr}
              onClick={() => !isPast && isCurrentMonth && !isCurrentDate && onDateToggle(dayStr)}
              disabled={isPast || !isCurrentMonth || isCurrentDate}
              className={`
                text-xs h-8 rounded transition-colors
                ${
                  isPast || !isCurrentMonth
                    ? 'opacity-30 cursor-not-allowed'
                    : isCurrentDate
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-80 cursor-pointer'
                }
              `}
              style={{
                background: isSelected 
                  ? 'var(--foreground)' 
                  : isTodayDate
                    ? 'color-mix(in srgb, var(--foreground) 20%, transparent)'
                    : isCurrentDate
                      ? 'color-mix(in srgb, var(--foreground) 15%, transparent)'
                      : 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                color: isSelected 
                  ? 'var(--background)' 
                  : 'var(--foreground)',
                border: isTodayDate && !isSelected
                  ? '1px solid var(--foreground)'
                  : 'none'
              }}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-3 text-xs opacity-70">
        <div className="flex flex-wrap gap-2 justify-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'var(--foreground)' }}></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border" style={{ borderColor: 'var(--foreground)' }}></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'color-mix(in srgb, var(--foreground) 15%, transparent)' }}></div>
            <span>Current</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Allow day styling on RBC
declare module "react-big-calendar" {
  interface CalendarProps {
    dayPropGetter?: (date: Date) => { className?: string; style?: React.CSSProperties };
    className?: string;
  }
}

interface CalendarProps { userId: string; }
interface Schedule {
  id: string; 
  userId: string; 
  date: Date; 
  timeSlots: TimeSlot[]; 
  createdAt: Date; 
  updatedAt: Date;
}
interface Booking {
  id: string; 
  startTime: string;
  endTime: string;
  guestName: string; 
  guestEmail: string; 
  notes?: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELED"; 
  createdAt: string;
}

export default function Calendar({ userId }: CalendarProps) {
  const router = useRouter();
  // Initialize with today's date selected
  const [selectedDate, setSelectedDate] = useState<Date | null>(startOfDay(new Date()));
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // New time slot form state
  const [newSlotStart, setNewSlotStart] = useState<string>("");
  const [newSlotEnd, setNewSlotEnd] = useState<string>("");
  const [newSlotMaxSlots, setNewSlotMaxSlots] = useState<number>(1);
  
  // Replication state
  const [selectedReplicationDates, setSelectedReplicationDates] = useState<string[]>([]);
  const [showReplicationModal, setShowReplicationModal] = useState(false);

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

  const addTimeSlot = () => {
    if (!newSlotStart || !newSlotEnd || newSlotMaxSlots < 1) {
      toast({ title: "Error", description: "Please fill in all time slot details", variant: "destructive" });
      return;
    }
    
    if (newSlotStart >= newSlotEnd) {
      toast({ title: "Error", description: "End time must be after start time", variant: "destructive" });
      return;
    }
    
    // Check for overlaps
    const hasOverlap = selectedTimeSlots.some(slot => 
      (newSlotStart < slot.endTime && newSlotEnd > slot.startTime)
    );
    
    if (hasOverlap) {
      toast({ title: "Error", description: "Time slots cannot overlap", variant: "destructive" });
      return;
    }
    
    const newSlot: TimeSlot = {
      startTime: newSlotStart,
      endTime: newSlotEnd,
      maxSlots: newSlotMaxSlots,
      bookedSlots: 0
    };
    
    setSelectedTimeSlots(prev => [...prev, newSlot].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    
    // Clear form
    setNewSlotStart("");
    setNewSlotEnd("");
    setNewSlotMaxSlots(1);
  };
  
  const removeTimeSlot = (index: number) => {
    setSelectedTimeSlots(prev => prev.filter((_, i) => i !== index));
  };
  
  const updateTimeSlotMaxSlots = (index: number, maxSlots: number) => {
    if (maxSlots < 1) return;
    setSelectedTimeSlots(prev => 
      prev.map((slot, i) => i === index ? { ...slot, maxSlots } : slot)
    );
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
      
      // Prepare replication dates if any
      const replicateDates = selectedReplicationDates.length > 0 
        ? selectedReplicationDates 
        : undefined;
      
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          date: formattedDate, 
          timeSlots: selectedTimeSlots, 
          userId,
          replicateDates
        }),
      });
      
      if (!response.ok) throw new Error("Failed to save schedule");
      
      const data = await response.json();
      
      toast({ 
        title: "Success", 
        description: data.message || "Your schedule has been updated" 
      });
      
      if (selectedTimeSlots.length === 0) {
        // Cleared schedule: show editor state as unscheduled
        setSchedules([]);
        setSelectedTimeSlots([]);
        setIsFormOpen(true);
        setIsEditing(true); // stay in editor for adding new slots quickly
      } else {
        setIsFormOpen(false);
        setIsEditing(false);
        // Reset replication dates
        setSelectedReplicationDates([]);
        setShowReplicationModal(false);
      }
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to save your schedule", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleReplicationDate = (dateStr: string) => {
    setSelectedReplicationDates(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr) 
        : [...prev, dateStr]
    );
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
                      <div className="font-semibold">{b.startTime}-{b.endTime}</div>
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
                    <div key={index} className="p-3 rounded-md border"
                         style={{ 
                           background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
                           borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" 
                         }}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{slot.startTime}-{slot.endTime} IST</div>
                        <div className="text-sm text-opacity-70">
                          {slot.maxSlots - slot.bookedSlots}/{slot.maxSlots} available
                        </div>
                      </div>
                      {slot.bookedSlots > 0 && (
                        <div className="mt-1 text-xs opacity-60">
                          {slot.bookedSlots} booked
                        </div>
                      )}
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
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Configure Time Slots</h3>
                
                {/* Add new time slot form */}
                <div className="p-4 border rounded-md mb-4"
                     style={{ borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}>
                  <h4 className="text-sm font-medium mb-3">Add Time Slot</h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newSlotStart}
                        onChange={(e) => setNewSlotStart(e.target.value)}
                        className="w-full px-2 py-1 rounded border text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">End Time</label>
                      <input
                        type="time"
                        value={newSlotEnd}
                        onChange={(e) => setNewSlotEnd(e.target.value)}
                        className="w-full px-2 py-1 rounded border text-sm"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs font-medium block mb-1">Available Slots</label>
                    <input
                      type="number"
                      value={newSlotMaxSlots}
                      onChange={(e) => setNewSlotMaxSlots(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 rounded border text-sm"
                      placeholder="Number of available bookings for this time"
                    />
                  </div>
                  <button
                    onClick={addTimeSlot}
                    className="w-full px-3 py-1 text-xs rounded-md"
                    style={{ background: "var(--foreground)", color: "var(--background)" }}
                  >
                    Add Time Slot
                  </button>
                </div>
                
                {/* Current time slots */}
                <div className="max-h-60 overflow-y-auto">
                  {selectedTimeSlots.length === 0 ? (
                    <div className="p-3 border rounded-md text-center text-sm opacity-60"
                         style={{ borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}>
                      No time slots configured. Add some above.
                    </div>
                  ) : (
                    selectedTimeSlots.map((slot, index) => (
                      <div key={index} className="p-3 border rounded-md mb-2"
                           style={{ 
                             background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
                             borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)"
                           }}>
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{slot.startTime}-{slot.endTime}</div>
                          <button
                            onClick={() => removeTimeSlot(index)}
                            className="text-xs px-2 py-1 rounded border text-red-600"
                            style={{ borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center mt-2 gap-2">
                          <label className="text-xs">Max Slots:</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={slot.maxSlots}
                            onChange={(e) => updateTimeSlotMaxSlots(index, parseInt(e.target.value) || 1)}
                            className="w-16 px-1 py-0.5 rounded border text-xs"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* Replication section */}
                {isEditing && selectedTimeSlots.length > 0 && (
                  <div className="p-3 border rounded-md mb-4"
                       style={{ borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}>
                    <button
                      onClick={() => setShowReplicationModal(!showReplicationModal)}
                      className="text-sm font-medium mb-2 flex items-center gap-1"
                    >
                      📅 Replicate to Other Dates {showReplicationModal ? '▲' : '▼'}
                    </button>
                    {showReplicationModal && (
                      <div>
                        <div className="text-xs mb-3">
                          <p className="opacity-70 mb-1">
                            👆 Click on dates in the calendar below to select them for replication
                          </p>
                          <p className="text-xs opacity-60">
                            • Past dates and the current date are disabled
                            • Click selected dates again to deselect them
                            • Navigate months using arrow buttons
                          </p>
                        </div>
                        
                        {/* Mini Calendar for Date Selection */}
                        <div className="border rounded-md mb-3"
                             style={{ borderColor: "color-mix(in srgb, var(--foreground) 20%, transparent)" }}>
                          <ReplicationCalendar 
                            selectedDates={selectedReplicationDates}
                            onDateToggle={toggleReplicationDate}
                            currentDate={selectedDate}
                          />
                        </div>
                        
                        {selectedReplicationDates.length > 0 && (
                          <div className="text-xs mb-2">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium">Selected dates ({selectedReplicationDates.length}):</p>
                              <button
                                onClick={() => setSelectedReplicationDates([])}
                                className="text-xs px-2 py-1 rounded border text-red-600"
                                style={{ borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                              >
                                Clear All
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {selectedReplicationDates
                                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                                .map(dateStr => (
                                <span 
                                  key={dateStr}
                                  className="px-2 py-1 rounded text-xs flex items-center gap-1"
                                  style={{ 
                                    background: "color-mix(in srgb, var(--foreground) 15%, transparent)" 
                                  }}
                                >
                                  <span>{format(new Date(dateStr), 'MMM d, yyyy')}</span>
                                  <button
                                    onClick={() => toggleReplicationDate(dateStr)}
                                    className="text-red-600 hover:text-red-800 font-bold"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="p-2 rounded" 
                                 style={{ background: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
                              <p className="font-medium text-green-600">
                                ✓ Will apply schedule to {selectedReplicationDates.length + 1} dates total
                              </p>
                              <p className="opacity-70 mt-1">
                                Original: {selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
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
                        {isLoading ? "Saving..." : (
                          selectedTimeSlots.length === 0 
                            ? "Clear Schedule" 
                            : selectedReplicationDates.length > 0
                              ? `Save to ${selectedReplicationDates.length + 1} dates`
                              : "Save Schedule"
                        )}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}