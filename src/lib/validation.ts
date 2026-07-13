const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | null | undefined) {
  if (!value) return true;
  return emailPattern.test(value);
}

export function isValidDateString(value: string | null | undefined) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function cleanText(value: string, maxLength = 180) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}
