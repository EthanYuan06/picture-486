/**
 * Format a date string to yyyy-mm-dd
 * @param dateString - The date string to format
 * @returns The formatted date string
 */
export const formatDate = (date: string | number | Date | undefined | null): string => {
  if (!date) return '';

  let d: Date;

  if (typeof date === 'number') {
    d = new Date(date);
  } else if (typeof date === 'string') {
    // Check if it's a timestamp string (all digits)
    if (/^\d+$/.test(date)) {
      d = new Date(parseInt(date, 10));
    } else {
      d = new Date(date);
      // Handle "YYYY-MM-DD HH:mm:ss" format for Safari/older browsers
      if (isNaN(d.getTime()) && date.includes(' ')) {
        d = new Date(date.replace(' ', 'T'));
      }
    }
  } else if (date instanceof Date) {
    d = date;
  } else {
    return '';
  }

  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
