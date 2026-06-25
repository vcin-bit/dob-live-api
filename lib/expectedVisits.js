/**
 * Shared helper for expected-visit date expansion.
 */
function expandBookingDays(from, to) {
  const fromDate = new Date(from + 'T00:00:00');
  const toDate = new Date(to + 'T00:00:00');
  if (isNaN(fromDate) || isNaN(toDate)) return { error: 'invalid_dates', message: 'expected_from and expected_to must be valid YYYY-MM-DD dates.' };

  if (toDate < fromDate) return { error: 'invalid_range', message: 'expected_to must be on or after expected_from.' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (fromDate < today) return { error: 'date_in_past', message: 'expected_from must be today or later.' };

  const spanDays = Math.round((toDate - fromDate) / 86400000) + 1;
  if (spanDays > 90) return { error: 'range_too_long', message: 'Bookings are limited to 90 days.' };

  const days = [];
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return { days };
}

module.exports = { expandBookingDays };
