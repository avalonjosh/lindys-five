interface DateNavigationProps {
  selectedDate: string; // YYYY-MM-DD format
  onDateChange: (date: string) => void;
}

// Format date for display
const formatDisplayDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Get date string in YYYY-MM-DD format
const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Add days to a date string
const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return getDateString(date);
};

export default function DateNavigation({ selectedDate, onDateChange }: DateNavigationProps) {
  const today = getDateString(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  const isToday = selectedDate === today;
  const isYesterday = selectedDate === yesterday;
  const isTomorrow = selectedDate === tomorrow;

  const handlePrev = () => {
    onDateChange(addDays(selectedDate, -1));
  };

  const handleNext = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const buttonBaseClass = `px-3 py-1.5 rounded-lg text-sm font-semibold transition-all`;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main date navigation */}
      <div className="flex items-center gap-4">
        {/* Previous button */}
        <button
          onClick={handlePrev}
          className="p-2 rounded-full transition-all text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Previous day"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Current date display */}
        <div className="text-lg md:text-xl font-bold min-w-[200px] text-center text-white">
          {formatDisplayDate(selectedDate)}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="p-2 rounded-full transition-all text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Next day"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Quick links */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDateChange(yesterday)}
          className={`${buttonBaseClass} ${
            isYesterday
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Yesterday
        </button>
        <button
          onClick={() => onDateChange(today)}
          className={`${buttonBaseClass} ${
            isToday
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => onDateChange(tomorrow)}
          className={`${buttonBaseClass} ${
            isTomorrow
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Tomorrow
        </button>
      </div>
    </div>
  );
}
