export interface ActivityWatchInstance {
  id: string;
  name: string;
  hostname: string;
  apiUrl: string;
  apiKey: string | null;
  isActive: boolean;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityBucket {
  id: string;
  name: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  data: ActivityEvent[];
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  duration: number;
  data: Record<string, unknown>;
}

export interface WindowEvent {
  app: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
}

export interface AFKEvent {
  status: 'afk' | 'active';
  startTime: string;
  endTime: string;
  duration: number;
}

export interface ProductivityMetrics {
  totalActiveTime: number;
  totalAFKTime: number;
  totalIdleTime: number;
  focusTime: number;
  categorizedTime: CategorizedTime[];
  topApplications: ApplicationUsage[];
  hourlyBreakdown: HourlyActivity[];
}

export interface CategorizedTime {
  category: string;
  duration: number;
  percentage: number;
  color: string;
}

export interface ApplicationUsage {
  app: string;
  duration: number;
  percentage: number;
  category?: string;
}

export interface HourlyActivity {
  hour: number;
  active: number;
  afk: number;
  productive: number;
}

export interface ActivitySummary {
  date: string;
  totalTime: number;
  activeTime: number;
  afkTime: number;
  appCount: number;
  topApp?: string;
}

export interface TimePeriod {
  start: string;
  end: string;
}

export type PeriodType = 'day' | 'week' | 'month' | 'custom';

export interface ImportResult {
  date: string;
  totalActive: number;
  totalAfk: number;
  appCount: number;
  categoryCount: number;
}

export interface ImportResponse {
  days: ImportResult[];
  totalEvents: number;
}

export interface ImportedDayData {
  date: string;
  totalActive: number;
  totalAfk: number;
  apps: ApplicationUsage[];
  hourlyBreakdown: HourlyActivity[];
  categories: CategorizedTime[];
}
