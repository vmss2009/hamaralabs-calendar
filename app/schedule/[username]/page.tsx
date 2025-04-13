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
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-2/3">
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">{user.name} Schedule</h1>

            
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
                    cursor: isPastDate ? 'default' : 'pointer',
                    backgroundColor: isPastDate ? '#f3f4f6' : 'white',
                  },
                  className: isPastDate ? 'past-date' : '',
                };
              }}
              eventPropGetter={(event: Event) => ({
                style: {
                  backgroundColor: "#4f46e5",
                  borderRadius: "4px",
                  width: '90%',
                  margin: '0 auto',
                },
              })}
              components={{
                event: ({ event }: { event: CalendarEvent }) => (
                  <div className="p-1" onClick={() => handleSelectSlot(event)}>
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-xs">
                      {event.timeSlots?.length} time slots available
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </div>
        
        {/* Side panel for viewing time slots */}
        <div className="w-full md:w-1/3">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              {selectedDate
                ? `Available Time Slots for ${format(selectedDate, "MMMM d, yyyy")}`
                : "Select a date to view available time slots"}
            </h2>
            
            {selectedDate && isBefore(selectedDate, today) ? (
              <div className="text-center py-8 text-gray-500">
                No time slots available for past dates
              </div>
            ) : selectedSchedule ? (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    {selectedSchedule.timeSlots.length} time slots available
                  </p>
                </div>
                
                <div className="space-y-2">
                  {selectedSchedule.timeSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-md border border-gray-200"
                    >
                      <div className="font-medium text-gray-800">{slot}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedDate ? (
              <div className="text-center py-8 text-gray-500">
                No time slots available for this date
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Click on a date in the calendar to view available time slots
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 