export function formatGen(wei: string, decimals = 4): string {
  try {
    const value = BigInt(wei);
    const unit = 10n ** 18n;
    const whole = value / unit;
    const fraction = (value % unit)
      .toString()
      .padStart(18, "0")
      .slice(0, decimals)
      .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return wei;
  }
}

export function formatDate(epoch: number): string {
  if (!epoch) return "—";
  return new Date(epoch * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} h`;
}

export function short(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
