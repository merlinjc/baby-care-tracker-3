export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function calculateAgeInMonths(birthDate: Date): number {
  const now = new Date();
  const birth = new Date(birthDate);
  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months += now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

export function calculateAgeInDays(birthDate: Date): number {
  const now = new Date();
  const birth = new Date(birthDate);
  const diff = now.getTime() - birth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function formatAge(birthDate: Date): string {
  const months = calculateAgeInMonths(birthDate);
  if (months < 1) {
    const days = calculateAgeInDays(birthDate);
    return `${days}天`;
  }
  if (months < 12) {
    return `${months}个月`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return `${years}岁`;
  }
  return `${years}岁${remainingMonths}个月`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
  }
  return `${minutes}分钟`;
}
