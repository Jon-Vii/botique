function buildDateFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, options);
}

const shortDateFormatter = buildDateFormatter({
  month: "short",
  day: "numeric",
});

const shortDateTimeFormatter = buildDateFormatter({
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const mediumDateFormatter = buildDateFormatter({
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatDateShort(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

export function formatDateTimeShort(iso: string): string {
  return shortDateTimeFormatter.format(new Date(iso));
}

export function formatDateMedium(iso: string): string {
  return mediumDateFormatter.format(new Date(iso));
}

export function formatCurrency(
  amount: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
): string {
  const maxDigits = options?.maximumFractionDigits ?? 2;
  const minDigits = options?.minimumFractionDigits ?? Math.min(2, maxDigits);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    ...options,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(amount);
}

export function formatCompactCurrency(
  amount: number,
  currency = "USD",
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
