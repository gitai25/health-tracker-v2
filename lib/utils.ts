import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  });
}

// Format date to YYYY-MM-DD using local timezone (to match Oura/Whoop API)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(weeks: number = 12): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - weeks * 7);

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}
