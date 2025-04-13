"use client";

import { useState, useCallback } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isBefore, startOfDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { enUS } from 'date-fns/locale';

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

// Add this type declaration at the top of the file, after imports
declare module 'react-big-calendar' {
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

export default function Calendar({ userId }: CalendarProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch schedules for the selected date
  const fetchSchedules = useCallback(async (date: Date) => {
    try {
      setIsLoading(true);
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await fetch(`/api/schedules?date=${formattedDate}&userId=${userId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch schedules");
      }
      
      const data = await response.json();
      setSchedules(data);
      
      // If there's a schedule for this date, set the selected time slots
      if (data.length > 0) {
        setSelectedTimeSlots(data[0].timeSlots);
      } else {
        setSelectedTimeSlots([]);
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Error",
        description: "Failed to fetch your schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Handle date selection
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    const today = startOfDay(new Date());
    const selectedDate = startOfDay(slotInfo.start);
    
    // Set the selected date and open the form
    setSelectedDate(slotInfo.start);
    setIsFormOpen(true);
    setIsEditing(false);
    fetchSchedules(slotInfo.start);
  }, [fetchSchedules]);

  // Handle time slot selection
  const handleTimeSlotChange = (slot: string) => {
    setSelectedTimeSlots((prev) => {
      if (prev.includes(slot)) {
        return prev.filter((s) => s !== slot);
      } else {
        return [...prev, slot];
      }
    });
  };

  // Save schedule
  const saveSchedule = async () => {
    if (!selectedDate) return;
    
    const today = startOfDay(new Date());
    const selectedDateStart = startOfDay(selectedDate);
    
    // Check if the selected date is in the past
    if (isBefore(selectedDateStart, today)) {
      toast({
        title: "Cannot edit past dates",
        description: "You can only edit today's and future dates",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: formattedDate,
          timeSlots: selectedTimeSlots,
          userId,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save schedule");
      }
      
      toast({
        title: "Success",
        description: "Your schedule has been updated",
      });
      
      setIsFormOpen(false);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({
        title: "Error",
        description: "Failed to save your schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Start editing a schedule
  const startEditing = () => {
    const today = startOfDay(new Date());
    const selectedDateStart = selectedDate ? startOfDay(selectedDate) : null;
    
    // Check if the selected date is in the past
    if (selectedDateStart && isBefore(selectedDateStart, today)) {
      toast({
        title: "Cannot edit past dates",
        description: "You can only edit today's and future dates",
        variant: "destructive",
      });
      return;
    }
    
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    if (selectedDate) {
      fetchSchedules(selectedDate);
    }
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
                className: isBefore(date, today) ? 'past-date' : '',
                style: {
                  backgroundColor: isBefore(date, today) ? '#f3f4f6' : 'white',
                },
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
          
          {schedules.length > 0 && !isEditing ? (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Available Time Slots</h3>
                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
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
                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
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
