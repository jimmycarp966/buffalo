const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";
export const BUSINESS_DAY_START_HOUR = 6;
export const BUSINESS_DAY_END_HOUR = 3; // Del día siguiente

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARG_TIMEZONE,
});

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARG_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const rangeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARG_TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const padHour = (value: number) => value.toString().padStart(2, "0");

const shiftDateString = (dateStr: string, days: number) => {
  // Crear fecha en la zona horaria de Buenos Aires (usar mediodía para evitar problemas de zona horaria)
  const date = new Date(`${dateStr}T12:00:00-03:00`);
  date.setDate(date.getDate() + days);
  // Formatear en la zona horaria de Buenos Aires
  return dateFormatter.format(date);
};

const getArgDateParts = (date: Date) => {
  const parts = dateTimePartsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour") || "0"),
  };
};

export const getBusinessDateString = (date: Date = new Date()) => {
  const { dateStr, hour } = getArgDateParts(date);
  if (hour < BUSINESS_DAY_START_HOUR) {
    return shiftDateString(dateStr, -1);
  }
  return dateStr;
};

export const getBusinessDayRange = (dateStr: string) => {
  if (!dateStr) {
    throw new Error("dateStr is required");
  }

  const start = new Date(
    `${dateStr}T${padHour(BUSINESS_DAY_START_HOUR)}:00:00-03:00`,
  );
  const endDateStr =
    BUSINESS_DAY_END_HOUR <= BUSINESS_DAY_START_HOUR
      ? shiftDateString(dateStr, 1)
      : dateStr;
  const end = new Date(
    `${endDateStr}T${padHour(BUSINESS_DAY_END_HOUR)}:00:00-03:00`,
  );

  return { start, end };
};

export const formatBusinessRange = (start: Date, end: Date) => {
  return `${rangeFormatter.format(start)} ➝ ${rangeFormatter.format(end)} (hora Buenos Aires)`;
};

// Hora del día (0-23) en zona Argentina, para agrupar ventas por hora real
const argHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ARG_TIMEZONE,
  hour: "2-digit",
  hour12: false,
});
export const getArgHour = (date: Date) => Number(argHourFormatter.format(date)) % 24;

// Día de la semana en zona Argentina: 0=Domingo … 6=Sábado
const argWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ARG_TIMEZONE,
  weekday: "short",
});
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
export const getArgWeekday = (date: Date) =>
  WEEKDAY_INDEX[argWeekdayFormatter.format(date)] ?? 0;

// Convierte un YYYY-MM-DD (día ARG) a los límites UTC ISO para filtrar created_at.
// Cubre exactamente 00:00:00 a 23:59:59.999 hora Argentina (UTC-3).
export const argDayToUtcRange = (startDateStr: string, endDateStr: string) => {
  const startISO = new Date(`${startDateStr}T00:00:00.000-03:00`).toISOString();
  const endISO = new Date(`${endDateStr}T23:59:59.999-03:00`).toISOString();
  return { startISO, endISO };
};

export { ARG_TIMEZONE };

