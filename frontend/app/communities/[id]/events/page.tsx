'use client';

import { Suspense, useEffect, useState, forwardRef, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { compressImage, MAX_IMAGE_SIZE_BYTES } from '../../../lib/imageCompression';
import { useCommunityContext } from '../CommunityContext';
import FormSelect from '../../../components/FormSelect';
import CalendarSelect from '../../../components/CalendarSelect';
import DatePicker, { registerLocale } from 'react-datepicker';
import { he } from 'date-fns/locale';
import { getMonth, getYear } from 'date-fns';
import { 
  FaMapMarkerAlt,
  FaQuestion
} from 'react-icons/fa';
import CalendarIcon from '../../../components/icons/CalendarIcon';
import PlusIcon from '../../../components/icons/PlusIcon';
import ChevronRightIcon from '../../../components/icons/ChevronRightIcon';
import ChevronLeftIcon from '../../../components/icons/ChevronLeftIcon';
import ChevronDownIcon from '../../../components/icons/ChevronDownIcon';
import VideoIcon from '../../../components/icons/VideoIcon';
import ClockIcon from '../../../components/icons/ClockIcon';
import UsersIcon from '../../../components/icons/UsersIcon';
import CheckIcon from '../../../components/icons/CheckIcon';
import CloseIcon from '../../../components/icons/CloseIcon';
import EditIcon from '../../../components/icons/EditIcon';
import TrashIcon from '../../../components/icons/TrashIcon';
import MoreDotsIcon from '../../../components/icons/MoreDotsIcon';

// Short Hebrew day names for calendar - return single letter based on day name
const formatWeekDay = (nameOfDay: string) => {
  // Map by first letter or known patterns
  const name = nameOfDay.toLowerCase();
  if (name.startsWith('su') || name.includes('ראשון')) return "א'";
  if (name.startsWith('mo') || name.includes('שני')) return "ב'";
  if (name.startsWith('tu') || name.includes('שלישי')) return "ג'";
  if (name.startsWith('we') || name.includes('רביעי')) return "ד'";
  if (name.startsWith('th') || name.includes('חמישי')) return "ה'";
  if (name.startsWith('fr') || name.includes('שישי')) return "ו'";
  if (name.startsWith('sa') || name.includes('שבת')) return "ש'";
  return "א'";
};

// Hebrew month names
const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// Years range - only current year and future (for event creation)
const years = Array.from({ length: 10 }, (_, i) => getYear(new Date()) + i);

// Generate time options with 15-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      options.push(`${h}:${m}`);
    }
  }
  return options;
};

const timeOptions = generateTimeOptions();

// Validate if a date is real (e.g., Feb 30 is invalid)
const isValidDate = (day: number, month: number, year: number): boolean => {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
};

// Get current time rounded to nearest 15 minutes
const getCurrentTimeRounded = (): string => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  
  if (minutes === 60) {
    return `${(hours + 1).toString().padStart(2, '0')}:00`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Custom Date Input Component - simple text input with formatting
function DateInput({
  value,
  onChange,
  onIconClick,
}: {
  value: string;
  onChange: (dateISO: string, formatted: string) => void;
  onIconClick: () => void;
}) {
  const [inputValue, setInputValue] = useState('');

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear().toString();
        setInputValue(`${day}/${month}/${year}`);
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // Remove non-digits except slashes
    let digitsOnly = val.replace(/[^\d]/g, '');
    
    // Validate as we type
    if (digitsOnly.length >= 1) {
      const firstDigit = parseInt(digitsOnly[0]);
      if (firstDigit > 3) digitsOnly = '0' + digitsOnly; // Auto-prefix day
    }
    if (digitsOnly.length >= 2) {
      const day = parseInt(digitsOnly.slice(0, 2));
      if (day > 31) digitsOnly = '31' + digitsOnly.slice(2);
      if (day === 0) digitsOnly = '01' + digitsOnly.slice(2);
    }
    if (digitsOnly.length >= 3) {
      const thirdDigit = parseInt(digitsOnly[2]);
      if (thirdDigit > 1) digitsOnly = digitsOnly.slice(0, 2) + '0' + digitsOnly.slice(2); // Auto-prefix month
    }
    if (digitsOnly.length >= 4) {
      const month = parseInt(digitsOnly.slice(2, 4));
      if (month > 12) digitsOnly = digitsOnly.slice(0, 2) + '12' + digitsOnly.slice(4);
      if (month === 0) digitsOnly = digitsOnly.slice(0, 2) + '01' + digitsOnly.slice(4);
    }
    if (digitsOnly.length >= 5) {
      const yearStart = parseInt(digitsOnly[4]);
      if (yearStart !== 2) digitsOnly = digitsOnly.slice(0, 4) + '2' + digitsOnly.slice(5);
    }
    
    // Format as dd/mm/yyyy
    let formatted = '';
    for (let i = 0; i < digitsOnly.length && i < 8; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += digitsOnly[i];
    }
    
    setInputValue(formatted);
    
    // Parse and validate when complete
    if (digitsOnly.length === 8) {
      const day = parseInt(digitsOnly.slice(0, 2));
      const month = parseInt(digitsOnly.slice(2, 4));
      const year = parseInt(digitsOnly.slice(4, 8));
      const currentYear = new Date().getFullYear();
      
      // Check if date is valid and not in the past
      const enteredDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDate = enteredDate < today;
      
      if (isValidDate(day, month, year) && year >= currentYear && year <= currentYear + 10 && !isPastDate) {
        const isoDate = `${year}-${digitsOnly.slice(2, 4)}-${digitsOnly.slice(0, 2)}`;
        onChange(isoDate, formatted);
      } else {
        onChange('', '');
      }
    } else {
      onChange('', '');
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        style={{ borderRadius: '10px', borderColor: '#D0D0D4', paddingTop: '6px', paddingBottom: '6px', color: '#7A7A83' }}
        className="w-full pr-10 pl-3 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white text-right"
        dir="ltr"
      />
      <CalendarIcon
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 cursor-pointer text-[#7A7A83]"
        onClick={onIconClick}
      />
    </div>
  );
}

// Custom Time Picker Component - simple text input with dropdown
function TimePicker({
  value,
  onChange,
  selectedDate,
}: {
  value: string;
  onChange: (time: string) => void;
  selectedDate?: string; // ISO date string to filter past times on today
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      setInputValue(value);
    } else {
      setInputValue('');
    }
  }, [value]);

  // Scroll to current time when dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const currentTime = value || getCurrentTimeRounded();
      const index = timeOptions.findIndex((t) => t >= currentTime);
      if (index > 0) {
        const scrollPosition = Math.max(0, (index - 2) * 40);
        dropdownRef.current.scrollTop = scrollPosition;
      }
    }
  }, [isOpen, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Remove non-digits except colon
    let digitsOnly = val.replace(/[^\d]/g, '');

    // Validate as we type
    if (digitsOnly.length >= 1) {
      const firstDigit = parseInt(digitsOnly[0]);
      if (firstDigit > 2) digitsOnly = '0' + digitsOnly; // Auto-prefix hour
    }
    if (digitsOnly.length >= 2) {
      const hours = parseInt(digitsOnly.slice(0, 2));
      if (hours > 23) digitsOnly = '23' + digitsOnly.slice(2);
    }
    if (digitsOnly.length >= 3) {
      const thirdDigit = parseInt(digitsOnly[2]);
      if (thirdDigit > 5) digitsOnly = digitsOnly.slice(0, 2) + '0' + digitsOnly.slice(2); // Auto-prefix minute
    }
    if (digitsOnly.length >= 4) {
      const minutes = parseInt(digitsOnly.slice(2, 4));
      if (minutes > 59) digitsOnly = digitsOnly.slice(0, 2) + '59';
    }

    // Limit to 4 digits
    digitsOnly = digitsOnly.slice(0, 4);

    // Format as HH:MM
    let formatted = '';
    for (let i = 0; i < digitsOnly.length; i++) {
      if (i === 2) formatted += ':';
      formatted += digitsOnly[i];
    }

    setInputValue(formatted);

    // Parse and validate when complete
    if (digitsOnly.length === 4) {
      const hours = parseInt(digitsOnly.slice(0, 2));
      const minutes = parseInt(digitsOnly.slice(2, 4));

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        onChange(formatted);
      }
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder="hh:mm"
        maxLength={5}
        style={{ borderRadius: '10px', borderColor: '#D0D0D4', paddingTop: '6px', paddingBottom: '6px', color: '#7A7A83' }}
        className="w-full pr-10 pl-3 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white text-right"
        dir="ltr"
      />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#7A7A83]"
      >
        <ClockIcon size={16} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
          >
            {timeOptions.map((time) => {
              // Check if this time is in the past (only for today)
              const isToday = selectedDate === new Date().toISOString().split('T')[0];
              const now = new Date();
              const [hours, minutes] = time.split(':').map(Number);
              const isPastTime = isToday && (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes()));
              
              if (isPastTime) return null;
              
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    onChange(time);
                    setInputValue(time);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-right hover:bg-gray-100 transition ${
                    value === time ? 'bg-black text-white hover:bg-black' : 'text-black'
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface Event {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  date: string;
  endDate?: string;
  duration?: number;
  timezone?: string;
  isRecurring?: boolean;
  recurringType?: string;
  locationType?: string;
  locationName?: string;
  locationUrl?: string;
  category?: string;
  capacity?: number;
  attendeeType?: string;
  sendReminders?: boolean;
  reminderDays?: number;
  communityId: string;
  createdAt: string;
  userRsvp?: 'GOING' | 'MAYBE' | 'NOT_GOING' | null;
  rsvpCounts?: {
    going: number;
    maybe: number;
    notGoing: number;
  };
  _count?: {
    rsvps: number;
  };
}

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  image?: string;
  logo?: string;
}

const EVENT_CATEGORIES = [
  { value: 'workshop', label: 'סדנה' },
  { value: 'meetup', label: 'מפגש' },
  { value: 'webinar', label: 'וובינר' },
  { value: 'qa', label: 'שאלות ותשובות' },
  { value: 'social', label: 'חברתי' },
  { value: 'other', label: 'אחר' },
];

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function EventsPageContent() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;

  const { userEmail, userId, userProfile, isOwnerOrManager } = useCommunityContext();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userMemberships, setUserMemberships] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [addEventDate, setAddEventDate] = useState<Date | null>(null);

  // Double-tap detection for mobile (onDoubleClick doesn't work on touch)
  const lastTapRef = useRef<{ time: number; day: number }>({ time: 0, day: 0 });
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showSidebarDatePicker, setShowSidebarDatePicker] = useState(false);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    setMounted(true);

    const token = localStorage.getItem('token');
    if (token) {
      // Fetch communities user is member of
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/user/memberships`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : [])
        .then(data => {
          setCommunities(data);
          setUserMemberships(data.map((c: Community) => c.id));
        });
    }
  }, []);

  useEffect(() => {
    if (!communityId) return;

    const fetchData = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      try {
        // Fetch community
        const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (communityRes.ok) {
          const communityData = await communityRes.json();
          
          // Redirect to slug URL if community has a slug and we're using ID
          if (communityData.slug && communityId !== communityData.slug) {
            router.replace(`/communities/${communityData.slug}/events`);
          }
          
          setCommunity(communityData);
        }

        // Fetch events for current month (calendar view)
        await fetchEventsForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchAllEventsInitial = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/events/community/${communityId}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );
        if (res.ok) {
          const data = await res.json();
          // Sort by date - upcoming/newest events first (descending)
          const sortedEvents = data.sort((a: Event, b: Event) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          setAllEvents(sortedEvents);
        }
      } catch (err) {
        console.error('Error fetching all events:', err);
      }
    };

    fetchData();
    fetchAllEventsInitial();
  }, [communityId]);

  const fetchEventsForMonth = async (year: number, month: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/community/${communityId}/calendar?year=${year}&month=${month}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const fetchAllEvents = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/community/${communityId}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      if (res.ok) {
        const data = await res.json();
        // Sort by date - upcoming/newest events first (descending)
        const sortedEvents = data.sort((a: Event, b: Event) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setAllEvents(sortedEvents);
      }
    } catch (err) {
      console.error('Error fetching all events:', err);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
    fetchEventsForMonth(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month);
    setCurrentDate(newDate);
    setShowMonthDropdown(false);
    fetchEventsForMonth(newDate.getFullYear(), month + 1);
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);
    setShowYearDropdown(false);
    fetchEventsForMonth(year, newDate.getMonth() + 1);
  };

  const handleDeleteEvent = async (eventId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId));
        setAllEvents(prev => prev.filter(e => e.id !== eventId));
        setDeleteEventId(null);
      } else {
        alert('שגיאה במחיקת האירוע');
      }
    } catch (err) {
      console.error('Delete event error:', err);
      alert('שגיאה במחיקת האירוע');
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEditModal(true);
  };

  const handleRsvp = async (eventId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('אנא התחברו כדי לאשר הגעה');
      return;
    }

    const event = events.find(e => e.id === eventId);
    const previousRsvp = event?.userRsvp;
    const previousCounts = event?.rsvpCounts || { going: 0, maybe: 0, notGoing: 0 };
    
    // Optimistic update - update UI immediately
    const isRemoving = event?.userRsvp === status;
    
    // Calculate optimistic counts
    const optimisticCounts = { ...previousCounts };
    if (previousRsvp) {
      // Decrement previous status count
      if (previousRsvp === 'GOING') optimisticCounts.going = Math.max(0, optimisticCounts.going - 1);
      if (previousRsvp === 'MAYBE') optimisticCounts.maybe = Math.max(0, optimisticCounts.maybe - 1);
      if (previousRsvp === 'NOT_GOING') optimisticCounts.notGoing = Math.max(0, optimisticCounts.notGoing - 1);
    }
    if (!isRemoving) {
      // Increment new status count
      if (status === 'GOING') optimisticCounts.going++;
      if (status === 'MAYBE') optimisticCounts.maybe++;
      if (status === 'NOT_GOING') optimisticCounts.notGoing++;
    }
    
    // Update UI immediately
    setEvents(prev => prev.map(e => 
      e.id === eventId 
        ? { ...e, userRsvp: isRemoving ? null : status, rsvpCounts: optimisticCounts } 
        : e
    ));
    setAllEvents(prev => prev.map(e => 
      e.id === eventId 
        ? { ...e, userRsvp: isRemoving ? null : status, rsvpCounts: optimisticCounts } 
        : e
    ));

    try {
      // If clicking same status, remove RSVP
      if (isRemoving) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}/rsvp`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Update with server-confirmed counts
          setEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, rsvpCounts: data.rsvpCounts } : e
          ));
          setAllEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, rsvpCounts: data.rsvpCounts } : e
          ));
        } else {
          // Revert on error
          setEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, userRsvp: previousRsvp, rsvpCounts: previousCounts } : e
          ));
          setAllEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, userRsvp: previousRsvp, rsvpCounts: previousCounts } : e
          ));
        }
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventId}/rsvp`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = await res.json();
          // Update with server-confirmed counts
          setEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, rsvpCounts: data.rsvpCounts } : e
          ));
          setAllEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, rsvpCounts: data.rsvpCounts } : e
          ));
        } else {
          // Revert on error
          setEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, userRsvp: previousRsvp, rsvpCounts: previousCounts } : e
          ));
          setAllEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, userRsvp: previousRsvp, rsvpCounts: previousCounts } : e
          ));
        }
      }
    } catch (err) {
      console.error('RSVP error:', err);
      // Revert on error
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, userRsvp: previousRsvp, rsvpCounts: previousCounts } : e
      ));
      setAllEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, userRsvp: previousRsvp, rsvpCounts: previousCounts } : e
      ));
    }
  };

  // Calendar helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const monthName = HEBREW_MONTHS[date.getMonth()];
    return `${dayName}, ${day} ב${monthName}`;
  };

  // Format date as "23 בדצמבר 2025" for sidebar display
  const formatSidebarDate = (date: Date) => {
    const day = date.getDate();
    const monthName = HEBREW_MONTHS[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ב${monthName} ${year}`;
  };

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-24 bg-gray-50"></div>);
    }

    // Helper to get event style based on RSVP status
    const getEventStyle = (event: Event) => {
      if (!event.userRsvp) {
        // No response - white background with border
        return 'bg-white text-gray-800 border border-gray-300';
      }
      if (event.userRsvp === 'GOING') {
        // Going - black fill
        return 'bg-black text-white';
      }
      if (event.userRsvp === 'MAYBE') {
        // Maybe - diagonal stripes pattern
        return 'text-gray-700 border border-gray-300 maybe-striped';
      }
      if (event.userRsvp === 'NOT_GOING') {
        // Not going - line through
        return 'bg-gray-100 text-gray-400 line-through border border-gray-200';
      }
      return 'bg-white text-gray-800 border border-gray-300';
    };
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
      // Show all events in calendar view (including declined ones with visual indicator)
      const dayEvents = getEventsForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();
      
      // Check if this day is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDay = date < today;
      
      days.push(
        <div
          key={day}
          onClick={() => {
            setSelectedDate(date);
            // Double-tap detection for mobile
            const now = Date.now();
            if (lastTapRef.current.day === day && now - lastTapRef.current.time < 400) {
              if (isOwnerOrManager && !isPastDay) {
                const eventDate = new Date(year, month, day, 12, 0, 0);
                setAddEventDate(eventDate);
                setShowAddModal(true);
              }
              lastTapRef.current = { time: 0, day: 0 };
            } else {
              lastTapRef.current = { time: now, day };
            }
          }}
          onDoubleClick={() => {
            if (isOwnerOrManager && !isPastDay) {
              const eventDate = new Date(year, month, day, 12, 0, 0);
              setAddEventDate(eventDate);
              setShowAddModal(true);
            }
          }}
          className={`h-16 sm:h-24 p-1 transition ${isPastDay ? 'bg-gray-200 cursor-default' : 'cursor-pointer hover:bg-gray-50'} ${
            isSelected ? 'bg-gray-100 border border-gray-600' : isToday ? 'bg-gray-100' : 'border border-gray-100'
          }`}
        >
          <div className={`text-sm font-medium mb-1 pr-2 pt-1 ${
            isPastDay ? 'text-gray-400' : isToday && !isSelected ? 'text-black font-bold' : 'text-gray-700'
          }`}>
            {day}
          </div>
          <div className="space-y-0.5">
            {dayEvents.slice(0, 2).map(event => {
              const isEventPast = new Date(event.date) < new Date();
              return (
                <div
                  key={event.id}
                  className={`text-xs px-1 py-0.5 rounded truncate ${isEventPast ? 'bg-gray-200 text-gray-400 opacity-60' : getEventStyle(event)}`}
                >
                  {formatTime(event.date)} {event.title}
                </div>
              );
            })}
            {dayEvents.length > 2 && (
              <div className="text-xs text-gray-500 px-1">
                +{dayEvents.length - 2} נוספים
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  // Show all events in calendar view sidebar (including declined with visual indicator)
  const selectedDateEvents = selectedDate 
    ? getEventsForDate(selectedDate)
    : [];

  if (!communityId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">לא נבחרה קהילה</p>
      </div>
    );
  }

  // No loading spinner - content renders immediately like other pages

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Month Navigation - New Style */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                {/* Right arrow (prev month - RTL) */}
                <button
                  onClick={() => handleMonthChange('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>

                {/* Center: Unified Date Picker Button */}
                <div className="relative flex items-center">
                  <button
                    onClick={() => setShowSidebarDatePicker(!showSidebarDatePicker)}
                    className="flex items-center justify-center gap-2 px-3 py-1 rounded-lg hover:bg-[#E4E4E7] transition"
                    style={{ backgroundColor: '#F4F4F5', border: '1px solid #D0D0D4' }}
                  >
                    <span className="text-base font-medium text-black">
                      {selectedDate && selectedDate.getMonth() === currentDate.getMonth() && selectedDate.getFullYear() === currentDate.getFullYear()
                        ? `${selectedDate.getDate()} ב${HEBREW_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                        : `${HEBREW_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                      }
                    </span>
                    <ChevronDownIcon size={16} className="text-black" />
                  </button>
                  
                  {showSidebarDatePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSidebarDatePicker(false)} />
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50">
                        <DatePicker
                          selected={selectedDate || null}
                          openToDate={currentDate}
                          onChange={(d: Date | null) => {
                            if (d) {
                              setSelectedDate(d);
                              setCurrentDate(d);
                              fetchEventsForMonth(d.getFullYear(), d.getMonth() + 1);
                            }
                            setShowSidebarDatePicker(false);
                          }}
                          inline
                          locale="he"
                          formatWeekDay={formatWeekDay}
                          renderCustomHeader={({
                            date: headerDate,
                            changeYear,
                            changeMonth,
                            decreaseMonth,
                            increaseMonth,
                            prevMonthButtonDisabled,
                            nextMonthButtonDisabled,
                          }) => (
                            <div className="flex items-center justify-between px-4 py-3">
                              <button
                                type="button"
                                onClick={decreaseMonth}
                                disabled={prevMonthButtonDisabled}
                                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                              >
                                <ChevronRightIcon className="w-4 h-4" />
                              </button>
                              <div className="flex gap-3">
                                <CalendarSelect
                                  value={getMonth(headerDate)}
                                  onChange={(val) => changeMonth(val)}
                                  options={hebrewMonths.map((month, i) => ({ value: i, label: month }))}
                                />
                                <CalendarSelect
                                  value={getYear(headerDate)}
                                  onChange={(val) => changeYear(val)}
                                  options={Array.from({ length: 11 }, (_, i) => ({ value: 2020 + i, label: String(2020 + i) }))}
                                  className="min-w-[5rem]"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={increaseMonth}
                                disabled={nextMonthButtonDisabled}
                                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                              >
                                <ChevronLeftIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>
                
                {/* Left arrow (next month - RTL) */}
                <button
                  onClick={() => handleMonthChange('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {HEBREW_DAYS.map(day => (
                  <div key={day} className="py-2 text-center text-xs sm:text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {renderCalendar()}
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-4">
              {/* View Toggle & Add Event */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* View Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1 flex-1">
                    <button
                      onClick={() => setViewMode('calendar')}
                      className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition bg-white shadow text-black"
                    >
                      לוח שנה
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition text-gray-600"
                    >
                      רשימה
                    </button>
                  </div>

                  {isOwnerOrManager && (
                    <button
                      onClick={() => {
                        setAddEventDate(null);
                        setShowAddModal(true);
                      }}
                      className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition whitespace-nowrap"
                    >
                      <span>הוסף אירוע</span>
                      <PlusIcon size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Date Events */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 h-fit max-h-[calc(100vh-280px)] flex flex-col">
                {/* Date Title - Simple format */}
                <h3 className="font-bold text-black mb-4 flex-shrink-0">
                  {selectedDate 
                    ? formatDate(selectedDate.toISOString())
                    : 'בחרו תאריך'
                  }
                </h3>
                
                {selectedDate ? (
                  selectedDateEvents.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto flex-1 pb-4" dir="ltr">
                      <div dir="rtl" className="space-y-3">
                        {selectedDateEvents.map(event => (
                          <EventCard 
                            key={event.id} 
                            event={event} 
                            onRsvp={handleRsvp}
                            onEdit={handleEditEvent}
                            onDelete={(id) => setDeleteEventId(id)}
                            rsvpLoading={rsvpLoading}
                            isManager={isOwnerOrManager}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">אין אירועים בתאריך זה</p>
                  )
                ) : (
                  <p className="text-gray-500 text-sm">לחצו על תאריך בלוח השנה</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* List View - shows all events */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
            {/* Events List */}
            <div className="space-y-4">
              {allEvents.length > 0 ? (
                allEvents.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onRsvp={handleRsvp}
                      onEdit={handleEditEvent}
                      onDelete={(id) => setDeleteEventId(id)}
                      rsvpLoading={rsvpLoading}
                      isManager={isOwnerOrManager}
                    />
                  ))
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">אין אירועים קרובים</p>
                </div>
              )}
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-4">
              {/* View Toggle & Add Event */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* View Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1 flex-1">
                    <button
                      onClick={() => setViewMode('calendar')}
                      className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition text-gray-600"
                    >
                      לוח שנה
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition bg-white shadow text-black"
                    >
                      רשימה
                    </button>
                  </div>

                  {isOwnerOrManager && (
                    <button
                      onClick={() => {
                        setAddEventDate(null);
                        setShowAddModal(true);
                      }}
                      className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition whitespace-nowrap"
                    >
                      <span>הוסף אירוע</span>
                      <PlusIcon size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <AddEventModal
          communityId={communityId}
          initialDate={addEventDate}
          onClose={() => {
            setShowAddModal(false);
            setAddEventDate(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setAddEventDate(null);
            fetchEventsForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
            fetchAllEvents();
          }}
        />
      )}

      {/* Edit Event Modal */}
      {showEditModal && editingEvent && (
        <EditEventModal
          event={editingEvent}
          communityId={communityId}
          onClose={() => {
            setShowEditModal(false);
            setEditingEvent(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingEvent(null);
            fetchEventsForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
            fetchAllEvents();
          }}
        />
      )}

      {/* Delete Event Confirmation Modal */}
      {deleteEventId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          onClick={() => setDeleteEventId(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center" dir="rtl">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <TrashIcon size={20} color="#DC2626" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">מחיקת אירוע</h3>
              <p className="text-gray-600 mb-6">האם אתם בטוחים שברצונכם למחוק את האירוע? פעולה זו לא ניתנת לביטול.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteEventId(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  ביטול
                </button>
                <button
                  onClick={() => handleDeleteEvent(deleteEventId)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition"
                >
                  מחיקה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Event Card Component
function EventCard({ 
  event, 
  onRsvp, 
  onEdit,
  onDelete,
  rsvpLoading,
  isManager = false,
  compact = false 
}: { 
  event: Event; 
  onRsvp: (eventId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') => void;
  onEdit?: (event: Event) => void;
  onDelete?: (eventId: string) => void;
  rsvpLoading: string | null;
  isManager?: boolean;
  compact?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  // Check if event is in the past
  const isPastEvent = new Date(event.date) < new Date();

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes === 30) return 'חצי שעה';
    if (minutes === 60) return 'שעה';
    if (minutes === 90) return 'שעה וחצי';
    if (minutes === 120) return 'שעתיים';
    if (minutes >= 60) return `${minutes / 60} שעות`;
    return `${minutes} דקות`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short'
    });
  };

  const getDateParts = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('he-IL', { month: 'short' }),
      weekday: dayNames[date.getDay()]
    };
  };

  const dateParts = getDateParts(event.date);
  const category = EVENT_CATEGORIES.find(c => c.value === event.category);
  const isLoading = rsvpLoading === event.id;

  return (
    <div className={`rounded-xl border overflow-hidden relative ${
      isPastEvent 
        ? 'bg-gray-100 border-gray-300 opacity-50 grayscale pointer-events-none' 
        : 'bg-white border-gray-200 hover:shadow-md transition'
    } ${compact ? '' : ''}`}>
      {/* Past Event Badge */}
      {isPastEvent && (
        <div className="absolute top-2 left-2 z-10 bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full border border-gray-300">
          אירוע שעבר
        </div>
      )}
      
      {/* Manager Menu */}
      {isManager && !isPastEvent && (
        <div className="absolute top-2 left-2 z-10">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-gray-100 transition"
          >
            <MoreDotsIcon size={12} color="#4B5563" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1 z-50 min-w-[120px]" dir="rtl">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit?.(event);
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 rounded-md"
                >
                  <EditIcon size={14} className="flex-shrink-0" />
                  <span>ערוך</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete?.(event.id);
                  }}
                  className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-md"
                >
                  <TrashIcon size={14} className="flex-shrink-0" />
                  <span>מחק</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className={compact ? 'p-3' : 'p-4 flex gap-4'}>
        {/* Date Box - only show in non-compact mode */}
        {!compact && (
          <div className="flex-shrink-0 text-center" style={{ width: '47px' }}>
            <div className="rounded-t-lg" style={{ backgroundColor: '#000000', height: '29px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 400, color: '#FFFFFF' }}>{dateParts.month}</span>
            </div>
            <div className="rounded-b-lg" style={{ border: '1px solid #D0D0D4', borderTop: 'none', height: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '6px' }}>
              <span style={{ fontSize: '21px', fontWeight: 600, lineHeight: '1', color: '#000000' }}>{dateParts.day}</span>
              <span style={{ fontSize: '13px', fontWeight: 400, lineHeight: '1', color: '#000000', marginTop: '4px' }}>{dateParts.weekday}</span>
            </div>
          </div>
        )}

        <div className="flex-1">
          {/* Category & Time */}
          <div className="flex items-center gap-3 mb-2">
            {category && !compact && (
              <span className="px-2 py-0.5 rounded-full text-black" style={{ backgroundColor: '#D0D0D4', fontSize: '14px', fontWeight: 400 }}>
                {category.label}
              </span>
            )}
            <span className="flex items-center gap-1 text-black" style={{ fontSize: '16px', fontWeight: 500 }}>
              <ClockIcon size={16} />
              {formatTime(event.date)}
              {event.duration && <span style={{ color: '#7A7A83', fontWeight: 400 }}>({formatDuration(event.duration)})</span>}
            </span>
          </div>

          {/* Title */}
          <h4 className="text-black mb-2" style={{ fontSize: compact ? '14px' : '18px', fontWeight: 600 }}>
            {event.title}
          </h4>

          {/* Description */}
          {event.description && !compact && (
            <p className="text-black mb-3 line-clamp-2" style={{ fontSize: '16px', fontWeight: 400 }}>{event.description}</p>
          )}

          {/* Location */}
          <div className="flex items-center gap-2 mb-3" style={{ color: '#52525B', fontSize: '14px', fontWeight: 400 }}>
            {event.locationType === 'online' ? (
              <>
                <VideoIcon size={14} />
                <span>{event.locationName || 'מפגש מקוון'}</span>
              </>
            ) : (
              <>
                <FaMapMarkerAlt style={{ width: '14px', height: '14px' }} />
                <span>{event.locationName || 'מפגש פיזי'}</span>
              </>
            )}
          </div>

          {/* Attendees Count */}
          {event.rsvpCounts && (
            <div className="flex items-center gap-1.5 mb-3" style={{ color: '#52525B', fontSize: '14px', fontWeight: 400 }}>
              <UsersIcon size={14} />
              <span>{event.rsvpCounts.going} אישרו הגעה</span>
            </div>
          )}

          {/* RSVP Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onRsvp(event.id, 'GOING')}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center py-2 rounded-full transition border ${
                event.userRsvp === 'GOING'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-gray-200 hover:bg-gray-50'
              }`}
              style={{ fontSize: '16px', fontWeight: 400 }}
            >
              מגיע/ה
            </button>
            <button
              onClick={() => onRsvp(event.id, 'MAYBE')}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center py-2 rounded-full transition border ${
                event.userRsvp === 'MAYBE'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-gray-200 hover:bg-gray-50'
              }`}
              style={{ fontSize: '16px', fontWeight: 400 }}
            >
              אולי
            </button>
            <button
              onClick={() => onRsvp(event.id, 'NOT_GOING')}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center py-2 rounded-full transition border ${
                event.userRsvp === 'NOT_GOING'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-gray-200 hover:bg-gray-50'
              }`}
              style={{ fontSize: '16px', fontWeight: 400 }}
            >
              לא מגיע/ה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Event Modal Component
function AddEventModal({
  communityId,
  initialDate,
  onClose,
  onSuccess,
}: {
  communityId: string;
  initialDate?: Date | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(initialDate ? initialDate.toISOString().split('T')[0] : '');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [timezone, setTimezone] = useState('Asia/Jerusalem');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('weekly');
  const [locationType, setLocationType] = useState('online');
  const [locationName, setLocationName] = useState('Zoom');
  const [locationUrl, setLocationUrl] = useState('');
  const [category, setCategory] = useState('');
  const [capacity, setCapacity] = useState('');
  const [sendReminders, setSendReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState('1');
  const [attendeeType, setAttendeeType] = useState('all');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('ניתן להעלות רק קבצי תמונה');
        e.target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError('גודל התמונה חורג מ-20MB');
        e.target.value = '';
        return;
      }
      // Compress image before setting
      const compressedFile = await compressImage(file);
      setCoverImage(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!title || !date || !time) {
      setError('אנא מלאו את כל השדות הנדרשים');
      return;
    }

    // Validate that the event is not in the past
    const eventDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (eventDateTime < now) {
      setError('לא ניתן ליצור אירוע בשעה שעברה');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('אנא התחברו');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('date', new Date(`${date}T${time}`).toISOString());
      formData.append('duration', duration);
      formData.append('timezone', timezone);
      formData.append('isRecurring', String(isRecurring));
      if (isRecurring) formData.append('recurringType', recurringType);
      formData.append('locationType', locationType);
      formData.append('locationName', locationName);
      formData.append('locationUrl', locationUrl);
      if (category) formData.append('category', category);
      if (capacity) formData.append('capacity', capacity);
      formData.append('sendReminders', String(sendReminders));
      formData.append('reminderDays', reminderDays);
      formData.append('attendeeType', attendeeType);
      if (coverImage) formData.append('coverImage', coverImage);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/community/${communityId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.message || 'שגיאה ביצירת האירוע');
      }
    } catch (err) {
      console.error('Create event error:', err);
      alert('שגיאה ביצירת האירוע');
    } finally {
      setLoading(false);
    }
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-black">הוסף אירוע</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" dir="ltr">
          <form onSubmit={handleSubmit} className="p-6 space-y-5" dir="rtl">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כותרת <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מפגש קהילה"
              maxLength={30}
              style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
              className="w-full px-4 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
            />
            <div className="text-xs text-gray-400 text-left">{title.length} / 30</div>
          </div>

          {/* Date, Time, Duration Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך <span className="text-red-500">*</span></label>
              <DateInput 
                value={date} 
                onChange={(isoDate) => setDate(isoDate)}
                onIconClick={() => setShowDatePicker(true)}
              />
              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute top-full right-0 mt-1 z-50">
                    <DatePicker
                      selected={date ? new Date(date) : new Date()}
                      onChange={(d: Date | null) => {
                        setDate(d ? d.toISOString().split('T')[0] : '');
                        setShowDatePicker(false);
                      }}
                      minDate={new Date()}
                      inline
                      locale="he"
                      formatWeekDay={formatWeekDay}
                      renderCustomHeader={({
                        date: headerDate,
                        changeYear,
                        changeMonth,
                        decreaseMonth,
                        increaseMonth,
                        prevMonthButtonDisabled,
                        nextMonthButtonDisabled,
                      }) => (
                        <div className="flex items-center justify-between px-4 py-3">
                          <button
                            type="button"
                            onClick={decreaseMonth}
                            disabled={prevMonthButtonDisabled}
                            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                          >
                            <ChevronRightIcon className="w-4 h-4" />
                          </button>
                          <div className="flex gap-3">
                            <CalendarSelect
                              value={getMonth(headerDate)}
                              onChange={(val) => changeMonth(val)}
                              options={hebrewMonths.map((month, i) => ({ value: i, label: month }))}
                            />
                            <CalendarSelect
                              value={getYear(headerDate)}
                              onChange={(val) => changeYear(val)}
                              options={years.map((year) => ({ value: year, label: String(year) }))}
                              className="min-w-[5rem]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={increaseMonth}
                            disabled={nextMonthButtonDisabled}
                            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                          >
                            <ChevronLeftIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שעה <span className="text-red-500">*</span></label>
              <TimePicker value={time} onChange={setTime} selectedDate={date} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">משך</label>
              <FormSelect
                value={duration}
                onChange={setDuration}
                options={[
                  { value: '30', label: 'חצי שעה' },
                  { value: '60', label: 'שעה' },
                  { value: '90', label: 'שעה וחצי' },
                  { value: '120', label: 'שעתיים' },
                  { value: '180', label: '3 שעות' },
                  { value: '240', label: '4 שעות' },
                  { value: '300', label: '5 שעות' },
                ]}
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 text-black rounded"
            />
            <label htmlFor="recurring" className="text-sm text-gray-700">אירוע חוזר</label>
            {isRecurring && (
              <div style={{ minWidth: '120px' }}>
                <FormSelect
                  value={recurringType}
                  onChange={setRecurringType}
                  options={[
                    { value: 'daily', label: 'יומי' },
                    { value: 'weekly', label: 'שבועי' },
                    { value: 'monthly', label: 'חודשי' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מיקום</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setLocationType('online');
                  setLocationName('Zoom');
                  setLocationUrl('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  locationType === 'online' 
                    ? 'border-black bg-gray-50' 
                    : 'border-gray-200'
                }`}
              >
                <VideoIcon size={16} />
                <span className="text-sm text-black">מקוון</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocationType('in-person');
                  setLocationName('');
                  setLocationUrl('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  locationType === 'in-person' 
                    ? 'border-black bg-gray-50' 
                    : 'border-gray-200'
                }`}
              >
                <FaMapMarkerAlt className="w-4 h-4" />
                <span className="text-sm text-black">פיזי</span>
              </button>
            </div>
            {locationType === 'online' ? (
              <div className="flex flex-wrap gap-2">
                <div style={{ minWidth: '140px' }}>
                  <FormSelect
                    value={locationName}
                    onChange={setLocationName}
                    options={[
                      { value: 'Zoom', label: 'Zoom' },
                      { value: 'Google Meet', label: 'Google Meet' },
                      { value: 'Microsoft Teams', label: 'Microsoft Teams' },
                    ]}
                  />
                </div>
                <input
                  type="text"
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  placeholder="קישור למפגש"
                  style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
                  className="flex-1 px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
                />
              </div>
            ) : (
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="כתובת או שם המקום"
                style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
                className="w-full px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="בואו להנות מחברה טובה."
              rows={3}
              maxLength={300}
              style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
              className="w-full px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black resize-none text-black text-right"
            />
            <div className="text-xs text-gray-400 text-left">{description.length} / 300</div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className="px-3 py-2 rounded-full text-sm transition-colors"
                  style={{
                    backgroundColor: category === cat.value ? '#A7EA7B' : '#E5E7EB',
                    color: category === cat.value ? '#163300' : '#000000',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מי יכול להשתתף</label>
              <FormSelect
                value={attendeeType}
                onChange={setAttendeeType}
                options={[
                  { value: 'all', label: 'כל החברים' },
                  { value: 'managers', label: 'מנהלים בלבד' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מספר משתתפים מקסימלי</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => {
                  const val = e.target.value;
                  const numVal = parseInt(val);
                  // Allow empty, or positive integers >= 1
                  if (val === '') {
                    setCapacity('');
                  } else if (!isNaN(numVal) && numVal >= 1 && /^\d+$/.test(val)) {
                    setCapacity(val);
                  } else if (!isNaN(numVal) && numVal < 1) {
                    // If value goes below 1 (e.g., arrow down from 1), clear to placeholder
                    setCapacity('');
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent minus, plus, e, period from being typed
                  if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                    e.preventDefault();
                  }
                  // Handle arrow down when at 1 - clear to placeholder
                  if (e.key === 'ArrowDown' && capacity === '1') {
                    e.preventDefault();
                    setCapacity('');
                  }
                }}
                placeholder="ללא הגבלה"
                style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
                className="w-full px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
              />
            </div>
          </div>

          {/* Reminders */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="checkbox"
              id="reminders"
              checked={sendReminders}
              onChange={(e) => setSendReminders(e.target.checked)}
              className="w-4 h-4 text-black rounded"
            />
            <label htmlFor="reminders" className="text-sm text-gray-700">שלח תזכורת במייל</label>
            {sendReminders && (
              <div style={{ minWidth: '120px' }}>
                <FormSelect
                  value={reminderDays}
                  onChange={setReminderDays}
                  options={[
                    { value: '1', label: 'יום לפני' },
                    { value: '2', label: 'יומיים לפני' },
                    { value: '7', label: 'שבוע לפני' },
                  ]}
                  openUpward
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'יוצר...' : 'צור אירוע'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Edit Event Modal Component
function EditEventModal({
  event,
  communityId,
  onClose,
  onSuccess,
}: {
  event: Event;
  communityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const eventDate = new Date(event.date);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [date, setDate] = useState(eventDate.toISOString().split('T')[0]);
  const [time, setTime] = useState(eventDate.toTimeString().slice(0, 5));
  const [duration, setDuration] = useState(String(event.duration || 60));
  const [timezone, setTimezone] = useState(event.timezone || 'Asia/Jerusalem');
  const [isRecurring, setIsRecurring] = useState(event.isRecurring || false);
  const [recurringType, setRecurringType] = useState(event.recurringType || 'weekly');
  const [locationType, setLocationType] = useState(event.locationType || 'online');
  const [locationName, setLocationName] = useState(event.locationName || '');
  const [locationUrl, setLocationUrl] = useState(event.locationUrl || '');
  const [category, setCategory] = useState(event.category || '');
  const [capacity, setCapacity] = useState(event.capacity ? String(event.capacity) : '');
  const [sendReminders, setSendReminders] = useState(event.sendReminders ?? true);
  const [reminderDays, setReminderDays] = useState(String(event.reminderDays || 1));
  const [attendeeType, setAttendeeType] = useState(event.attendeeType || 'all');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    event.coverImage ? `${event.coverImage}` : null
  );

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('ניתן להעלות רק קבצי תמונה');
        e.target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError('גודל התמונה חורג מ-20MB');
        e.target.value = '';
        return;
      }
      // Compress image before setting
      const compressedFile = await compressImage(file);
      setCoverImage(compressedFile);
      setCoverImagePreview(URL.createObjectURL(compressedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!title || !date || !time) {
      setError('אנא מלאו את כל השדות הנדרשים');
      return;
    }

    // Validate that the event is not in the past
    const eventDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (eventDateTime < now) {
      setError('לא ניתן לעדכן אירוע לשעה שעברה');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('אנא התחברו');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('date', new Date(`${date}T${time}`).toISOString());
      formData.append('duration', duration);
      formData.append('timezone', timezone);
      formData.append('isRecurring', String(isRecurring));
      if (isRecurring) formData.append('recurringType', recurringType);
      formData.append('locationType', locationType);
      formData.append('locationName', locationName);
      formData.append('locationUrl', locationUrl);
      if (category) formData.append('category', category);
      if (capacity) formData.append('capacity', capacity);
      formData.append('sendReminders', String(sendReminders));
      formData.append('reminderDays', reminderDays);
      formData.append('attendeeType', attendeeType);
      if (coverImage) formData.append('coverImage', coverImage);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.message || 'שגיאה בעדכון האירוע');
      }
    } catch (err) {
      console.error('Update event error:', err);
      alert('שגיאה בעדכון האירוע');
    } finally {
      setLoading(false);
    }
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-black">עריכת אירוע</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" dir="ltr">
          <form onSubmit={handleSubmit} className="p-6 space-y-5" dir="rtl">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כותרת <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מפגש קהילה"
              maxLength={30}
              style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
              className="w-full px-4 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
            />
            <div className="text-xs text-gray-400 text-left">{title.length} / 30</div>
          </div>

          {/* Date, Time, Duration Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך <span className="text-red-500">*</span></label>
              <DateInput 
                value={date} 
                onChange={(isoDate) => setDate(isoDate)}
                onIconClick={() => setShowDatePicker(true)}
              />
              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute top-full right-0 mt-1 z-50">
                    <DatePicker
                      selected={date ? new Date(date) : new Date()}
                      onChange={(d: Date | null) => {
                        setDate(d ? d.toISOString().split('T')[0] : '');
                        setShowDatePicker(false);
                      }}
                      minDate={new Date()}
                      inline
                      locale="he"
                      formatWeekDay={formatWeekDay}
                      renderCustomHeader={({
                        date: headerDate,
                        changeYear,
                        changeMonth,
                        decreaseMonth,
                        increaseMonth,
                        prevMonthButtonDisabled,
                        nextMonthButtonDisabled,
                      }) => (
                        <div className="flex items-center justify-between px-4 py-3">
                          <button
                            type="button"
                            onClick={decreaseMonth}
                            disabled={prevMonthButtonDisabled}
                            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                          >
                            <ChevronRightIcon className="w-4 h-4" />
                          </button>
                          <div className="flex gap-3">
                            <CalendarSelect
                              value={getMonth(headerDate)}
                              onChange={(val) => changeMonth(val)}
                              options={hebrewMonths.map((month, i) => ({ value: i, label: month }))}
                            />
                            <CalendarSelect
                              value={getYear(headerDate)}
                              onChange={(val) => changeYear(val)}
                              options={years.map((year) => ({ value: year, label: String(year) }))}
                              className="min-w-[5rem]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={increaseMonth}
                            disabled={nextMonthButtonDisabled}
                            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                          >
                            <ChevronLeftIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שעה <span className="text-red-500">*</span></label>
              <TimePicker value={time} onChange={setTime} selectedDate={date} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">משך</label>
              <FormSelect
                value={duration}
                onChange={setDuration}
                options={[
                  { value: '30', label: 'חצי שעה' },
                  { value: '60', label: 'שעה' },
                  { value: '90', label: 'שעה וחצי' },
                  { value: '120', label: 'שעתיים' },
                  { value: '180', label: '3 שעות' },
                  { value: '240', label: '4 שעות' },
                  { value: '300', label: '5 שעות' },
                ]}
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="checkbox"
              id="recurring-edit"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 text-black rounded"
            />
            <label htmlFor="recurring-edit" className="text-sm text-gray-700">אירוע חוזר</label>
            {isRecurring && (
              <div style={{ minWidth: '120px' }}>
                <FormSelect
                  value={recurringType}
                  onChange={setRecurringType}
                  options={[
                    { value: 'daily', label: 'יומי' },
                    { value: 'weekly', label: 'שבועי' },
                    { value: 'monthly', label: 'חודשי' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מיקום</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setLocationType('online');
                  setLocationName('Zoom');
                  setLocationUrl('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  locationType === 'online' 
                    ? 'border-black bg-gray-50' 
                    : 'border-gray-200'
                }`}
              >
                <VideoIcon size={16} />
                <span className="text-sm text-black">מקוון</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocationType('in-person');
                  setLocationName('');
                  setLocationUrl('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  locationType === 'in-person' 
                    ? 'border-black bg-gray-50' 
                    : 'border-gray-200'
                }`}
              >
                <FaMapMarkerAlt className="w-4 h-4" />
                <span className="text-sm text-black">פיזי</span>
              </button>
            </div>
            {locationType === 'online' ? (
              <div className="flex flex-wrap gap-2">
                <div style={{ minWidth: '140px' }}>
                  <FormSelect
                    value={locationName}
                    onChange={setLocationName}
                    options={[
                      { value: 'Zoom', label: 'Zoom' },
                      { value: 'Google Meet', label: 'Google Meet' },
                      { value: 'Microsoft Teams', label: 'Microsoft Teams' },
                    ]}
                  />
                </div>
                <input
                  type="text"
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  placeholder="קישור למפגש"
                  style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
                  className="flex-1 px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
                />
              </div>
            ) : (
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="כתובת או שם המקום"
                style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
                className="w-full px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="בואו להנות מחברה טובה."
              rows={3}
              maxLength={300}
              style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
              className="w-full px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black resize-none text-black text-right"
            />
            <div className="text-xs text-gray-400 text-left">{description.length} / 300</div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className="px-3 py-2 rounded-full text-sm transition-colors"
                  style={{
                    backgroundColor: category === cat.value ? '#A7EA7B' : '#E5E7EB',
                    color: category === cat.value ? '#163300' : '#000000',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מי יכול להשתתף</label>
              <FormSelect
                value={attendeeType}
                onChange={setAttendeeType}
                options={[
                  { value: 'all', label: 'כל החברים' },
                  { value: 'managers', label: 'מנהלים בלבד' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מספר משתתפים מקסימלי</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => {
                  const val = e.target.value;
                  const numVal = parseInt(val);
                  // Allow empty, or positive integers >= 1
                  if (val === '') {
                    setCapacity('');
                  } else if (!isNaN(numVal) && numVal >= 1 && /^\d+$/.test(val)) {
                    setCapacity(val);
                  } else if (!isNaN(numVal) && numVal < 1) {
                    // If value goes below 1 (e.g., arrow down from 1), clear to placeholder
                    setCapacity('');
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent minus, plus, e, period from being typed
                  if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                    e.preventDefault();
                  }
                  // Handle arrow down when at 1 - clear to placeholder
                  if (e.key === 'ArrowDown' && capacity === '1') {
                    e.preventDefault();
                    setCapacity('');
                  }
                }}
                placeholder="ללא הגבלה"
                style={{ borderRadius: '10px', borderColor: '#D0D0D4' }}
                className="w-full px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-black"
              />
            </div>
          </div>

          {/* Reminders */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="checkbox"
              id="reminders-edit"
              checked={sendReminders}
              onChange={(e) => setSendReminders(e.target.checked)}
              className="w-4 h-4 text-black rounded"
            />
            <label htmlFor="reminders-edit" className="text-sm text-gray-700">שלח תזכורת במייל</label>
            {sendReminders && (
              <div style={{ minWidth: '120px' }}>
                <FormSelect
                  value={reminderDays}
                  onChange={setReminderDays}
                  options={[
                    { value: '1', label: 'יום לפני' },
                    { value: '2', label: 'יומיים לפני' },
                    { value: '7', label: 'שבוע לפני' },
                  ]}
                  openUpward
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'מעדכן...' : 'עדכן אירוע'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsPageContent />
    </Suspense>
  );
}
