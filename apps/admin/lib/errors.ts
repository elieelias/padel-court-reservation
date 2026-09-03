// Converts unknown request failures into safe, readable messages for administrators.

export function getErrorMessage(error: { message?: string } | null, fallback: string) {
  if (!error?.message) return fallback;
  if (error.message.includes('reservations_no_active_overlap')) {
    return 'That time overlaps an active reservation.';
  }
  if (error.message.includes('blocked_periods_no_overlap')) {
    return 'That time overlaps another blocked period.';
  }
  if (error.message.includes('blocked_periods_unique_time')) {
    return 'This period is already blocked.';
  }
  return error.message;
}

export async function getEdgeFunctionError(
  error: { message?: string; context?: Response } | null,
  fallback: string,
) {
  try {
    const response = await error?.context?.json() as { error?: unknown } | undefined;
    if (typeof response?.error === 'string' && response.error) return response.error;
  } catch {
    // Some failed requests have no JSON body, so use the standard message.
  }
  return getErrorMessage(error, fallback);
}

export function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
