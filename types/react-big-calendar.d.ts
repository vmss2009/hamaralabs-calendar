declare module 'react-big-calendar' {
  import { ComponentType, ReactNode } from 'react';
  import { DateFormatOptions } from 'date-fns';

  export interface Event {
    id?: string | number;
    title?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
    [key: string]: any;
  }

  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: 'select' | 'click' | 'doubleClick';
    bounds: {
      x: number;
      y: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    box: {
      x: number;
      y: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  }

  export interface View {
    type: string;
    label: string;
    navigate: (date: Date, action: string) => Date;
  }

  export interface Views {
    month?: View;
    week?: View;
    day?: View;
    agenda?: View;
    work_week?: View;
  }

  export interface ToolbarProps {
    date: Date;
    view: View;
    views: Views;
    label: string;
    onNavigate: (action: string, date?: Date) => void;
    onView: (view: View) => void;
  }

  export interface CalendarProps {
    localizer: any;
    events: Event[];
    startAccessor: string | ((event: Event) => Date);
    endAccessor: string | ((event: Event) => Date);
    style?: React.CSSProperties;
    selectable?: boolean;
    onSelectSlot?: (slotInfo: SlotInfo) => void;
    onSelectEvent?: (event: Event) => void;
    views?: Views;
    defaultView?: string;
    view?: string;
    onView?: (view: View) => void;
    date?: Date;
    onNavigate?: (newDate: Date, action: string, e: React.SyntheticEvent) => void;
    getDayRange?: (date: Date, view: View) => { start: Date; end: Date };
    dayLayoutAlgorithm?: 'overlap' | 'no-overlap';
    eventPropGetter?: (event: Event, start: Date, end: Date, isSelected: boolean) => { style?: React.CSSProperties; className?: string };
    components?: {
      toolbar?: ComponentType<ToolbarProps>;
      event?: ComponentType<{ event: Event }>;
      header?: ComponentType<any>;
      dateCellWrapper?: ComponentType<any>;
    };
  }

  export interface dateFnsLocalizer {
    format: (date: Date, format: string, options?: DateFormatOptions) => string;
    parse: (str: string, format: string, options?: DateFormatOptions) => Date;
    startOfWeek: (date: Date, options?: { locale?: any; weekStartsOn?: number }) => Date;
    getDay: (date: Date) => number;
  }

  export const Calendar: React.ComponentType<CalendarProps>;
  export const dateFnsLocalizer: (config: {
    format: (date: Date, format: string, options?: DateFormatOptions) => string;
    parse: (str: string, format: string, options?: DateFormatOptions) => Date;
    startOfWeek: (date: Date, options?: { locale?: any; weekStartsOn?: number }) => Date;
    getDay: (date: Date) => number;
  }) => dateFnsLocalizer;
} 