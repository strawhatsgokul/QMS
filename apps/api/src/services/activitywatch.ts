import axios from 'axios';
import { prisma } from '../index.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import type {
  ActivityBucket,
  ActivityEvent,
  ProductivityMetrics,
  ApplicationUsage,
  CategorizedTime,
  ActivitySummary,
  PeriodType,
  ImportResult,
  ImportResponse,
} from '@veyon-aw/shared';

interface ActivityQuery {
  start?: string;
  end?: string;
  period?: PeriodType;
  instanceId?: string;
}

class ActivityWatchService {
  private async getApiUrl(instanceId?: string): Promise<string> {
    if (instanceId) {
      const instance = await prisma.activityWatchInstance.findUnique({
        where: { id: instanceId },
      });
      if (!instance) throw new Error(`ActivityWatch instance ${instanceId} not found`);
      return instance.apiUrl;
    }
    return config.activityWatch.apiUrl;
  }

  private async request<T>(
    path: string,
    instanceId?: string,
    params?: Record<string, string>,
    retries = 2,
  ): Promise<T> {
    const baseUrl = await this.getApiUrl(instanceId);
    const fullUrl = `${baseUrl}${path}`;
    logger.debug(`ActivityWatch request: ${fullUrl}`, { params });
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data } = await axios.get<T>(fullUrl, {
          params,
          timeout: 10000,
          headers: config.activityWatch.apiKey
            ? { Authorization: `Bearer ${config.activityWatch.apiKey}` }
            : undefined,
        });
        return data;
      } catch (error) {
        const isLast = attempt === retries;
        if (axios.isAxiosError(error) && (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') && !isLast) {
          logger.warn(`ActivityWatch request failed (attempt ${attempt + 1}/${retries + 1}), retrying: ${fullUrl}`);
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        logger.error('ActivityWatch API request failed:', { path, error });
        throw new Error(`ActivityWatch API error: ${path}`);
      }
    }
    throw new Error(`ActivityWatch API error: ${path}`);
  }

  async getBuckets(instanceId?: string): Promise<ActivityBucket[]> {
    try {
      const result = await this.request<Record<string, ActivityBucket>>('/0/buckets', instanceId);
      return Object.values(result);
    } catch {
      logger.warn('ActivityWatch unreachable, returning empty buckets');
      return [];
    }
  }

  async getEvents(query: ActivityQuery): Promise<ActivityEvent[]> {
    const { start, end, instanceId } = query;
    const params: Record<string, string> = {};
    if (start) params['start'] = start;
    if (end) params['end'] = end;

    const buckets = await this.getBuckets(instanceId);
    const allEvents: ActivityEvent[] = [];

    for (const bucket of buckets) {
      try {
        const events = await this.request<ActivityEvent[]>(
          `/0/buckets/${bucket.id}/events`,
          instanceId,
          params,
        );
        allEvents.push(...events);
      } catch (err) {
        logger.warn(`Failed to fetch events for bucket ${bucket.id}:`, err);
      }
    }

    return allEvents;
  }

  async getProductivityMetrics(query: ActivityQuery): Promise<ProductivityMetrics> {
    const { start, end, period = 'day' } = query;
    const timeRange = this.getTimeRange(period, start, end);

    const buckets = await this.getBuckets(query.instanceId);

    let totalActiveS = 0;
    let totalAFKS = 0;
    const appDuration: Map<string, number> = new Map();
    const hourlyData: Map<number, { active: number; afk: number }> = new Map();

    for (let h = 0; h < 24; h++) {
      hourlyData.set(h, { active: 0, afk: 0 });
    }

    for (const bucket of buckets) {
      try {
        const events = await this.request<ActivityEvent[]>(
          `/0/buckets/${bucket.id}/events`,
          query.instanceId,
          { start: timeRange.start, end: timeRange.end },
        );

        for (const event of events) {
          const duration = event.duration ?? 0;

          if (bucket.type === 'afkstatus') {
            if (event.data['status'] === 'afk') {
              totalAFKS += duration;
            } else {
              totalActiveS += duration;
            }
          }

          if (bucket.type === 'currentwindow') {
            const app = (event.data['app'] as string) || 'unknown';
            appDuration.set(app, (appDuration.get(app) ?? 0) + duration);

            const eventHour = new Date(event.timestamp).getHours();
            const existing = hourlyData.get(eventHour) ?? { active: 0, afk: 0 };
            existing.active += duration;
            hourlyData.set(eventHour, existing);
          }
        }
      } catch (err) {
        logger.warn(`Failed processing bucket ${bucket.id}:`, err);
      }
    }

    const totalSecs = totalActiveS + totalAFKS || 1;
    const sortedApps = [...appDuration.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([app, duration]) => ({
        app,
        duration: Math.round(duration / 60),
        percentage: Math.round((duration / totalSecs) * 100),
      }));

    const categories = await this.categorizeApps(sortedApps);

    const metrics: ProductivityMetrics = {
      totalActiveTime: Math.round(totalActiveS / 60),
      totalAFKTime: Math.round(totalAFKS / 60),
      totalIdleTime: 0,
      focusTime: Math.round(this.calculateFocusTime(sortedApps, totalSecs / 60)),
      categorizedTime: categories,
      topApplications: sortedApps,
      hourlyBreakdown: [...hourlyData.entries()]
        .sort(([a], [b]) => a - b)
        .map(([hour, data]) => ({
          hour,
          active: Math.round(data.active / 60),
          afk: Math.round(data.afk / 60),
          productive: Math.round(data.active / 60 * 0.7),
        })),
    };

    return metrics;
  }

  async getActivitySummary(query: ActivityQuery): Promise<ActivitySummary> {
    const metrics = await this.getProductivityMetrics(query);
    return {
      date: new Date().toISOString().split('T')[0] ?? '',
      totalTime: metrics.totalActiveTime + metrics.totalAFKTime,
      activeTime: metrics.totalActiveTime,
      afkTime: metrics.totalAFKTime,
      appCount: metrics.topApplications.length,
      topApp: metrics.topApplications[0]?.app,
    };
  }

  async getTopApplications(query: ActivityQuery): Promise<ApplicationUsage[]> {
    const metrics = await this.getProductivityMetrics(query);
    return metrics.topApplications;
  }

  async getCategoryBreakdown(query: ActivityQuery): Promise<CategorizedTime[]> {
    const metrics = await this.getProductivityMetrics(query);
    return metrics.categorizedTime;
  }

  async getInstances() {
    return prisma.activityWatchInstance.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async exportData(query: ActivityQuery): Promise<{
    summary: ActivitySummary;
    applications: ApplicationUsage[];
    categories: CategorizedTime[];
  }> {
    const [summary, applications, categories] = await Promise.all([
      this.getActivitySummary(query),
      this.getTopApplications(query),
      this.getCategoryBreakdown(query),
    ]);
    return { summary, applications, categories };
  }

  async exportHtml(query: ActivityQuery, userInfo?: { name: string; email: string }, nodeName?: string): Promise<string> {
    const data = await this.exportData(query);
    const { summary, applications, categories } = data;
    const now = new Date().toLocaleString();
    const periodLabel = query.period ?? 'day';
    const userDisplay = userInfo ? `${userInfo.name} (${userInfo.email})` : 'Unknown';
    const nodeDisplay = nodeName ?? 'All nodes';

    const appsTable = applications.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${a.app}</strong></td>
        <td>${a.duration}</td>
        <td>${a.percentage}%</td>
        <td><div class="bar"><div class="bar-fill" style="width:${a.percentage}%"></div></div></td>
      </tr>`).join('');

    const catRows = categories.map(c => `
      <tr>
        <td><span class="color-dot" style="background:${c.color}"></span> ${c.category}</td>
        <td>${c.duration} min</td>
        <td>${c.percentage}%</td>
        <td><div class="bar"><div class="bar-fill" style="width:${c.percentage}%;background:${c.color}"></div></div></td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Activity Report - ${summary.date}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f1f5f9; color:#1e293b; padding:20px; }
.container { max-width:900px; margin:0 auto; }
.header { background:linear-gradient(135deg,#3B82F6,#1D4ED8); color:white; border-radius:12px; padding:24px 32px; margin-bottom:20px; }
.header h1 { font-size:24px; margin-bottom:4px; }
.header .meta { font-size:13px; opacity:0.85; margin-top:8px; }
.header .meta span { display:inline-block; margin-right:20px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px; }
.card { background:white; border-radius:10px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.card .label { font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; }
.card .value { font-size:28px; font-weight:700; margin-top:4px; }
.section { background:white; border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:16px; overflow:hidden; }
.section-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; user-select:none; }
.section-header h2 { font-size:16px; font-weight:600; }
.section-header .toggle { font-size:18px; color:#94a3b8; transition:transform 0.2s; }
.section-header .toggle.open { transform:rotate(180deg); }
.section-body { padding:0 20px 20px; }
table { width:100%; border-collapse:collapse; }
th { text-align:left; padding:10px 8px; font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; cursor:pointer; }
th:hover { color:#3B82F6; }
td { padding:10px 8px; border-bottom:1px solid #f1f5f9; font-size:14px; }
.bar { height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; min-width:80px; }
.bar-fill { height:100%; background:#3B82F6; border-radius:4px; transition:width 0.3s; }
.color-dot { display:inline-block; width:10px; height:10px; border-radius:50%; vertical-align:middle; margin-right:6px; }
.summary-text { font-size:14px; color:#64748b; line-height:1.6; padding:8px 0; }
.hourly-grid { display:grid; grid-template-columns:repeat(24,1fr); gap:2px; margin-top:12px; }
.hour-cell { text-align:center; font-size:10px; color:#94a3b8; }
.hour-bar { height:40px; border-radius:3px; margin-bottom:2px; position:relative; min-height:4px; }
.hour-label { font-size:9px; }
.footer { text-align:center; font-size:12px; color:#94a3b8; padding:20px; }
@media print { body { background:white; padding:0; } .section { break-inside:avoid; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Activity Report</h1>
    <div class="meta">
      <span>User: ${userDisplay}</span>
      <span>Node: ${nodeDisplay}</span>
      <span>Period: ${periodLabel}</span>
      <span>Date: ${summary.date}</span>
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Total Time</div><div class="value" style="color:#3B82F6">${summary.totalTime}</div><div style="font-size:12px;color:#94a3b8">minutes</div></div>
    <div class="card"><div class="label">Active Time</div><div class="value" style="color:#10B981">${summary.activeTime}</div><div style="font-size:12px;color:#94a3b8">minutes</div></div>
    <div class="card"><div class="label">AFK Time</div><div class="value" style="color:#F59E0B">${summary.afkTime}</div><div style="font-size:12px;color:#94a3b8">minutes</div></div>
    <div class="card"><div class="label">Productivity</div><div class="value" style="color:#8B5CF6">${summary.totalTime ? Math.round((summary.activeTime / summary.totalTime) * 100) : 0}%</div><div style="font-size:12px;color:#94a3b8">active ratio</div></div>
  </div>

  <div class="section">
    <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.toggle').classList.toggle('open')">
      <h2>Top Applications (${applications.length})</h2>
      <span class="toggle">▼</span>
    </div>
    <div class="section-body">
      ${applications.length ? `<table><thead><tr><th>#</th><th onclick="sortTable(0)">App</th><th onclick="sortTable(1)">Duration</th><th onclick="sortTable(2)">%</th><th>Usage</th></tr></thead><tbody id="apps-tbody">${appsTable}</tbody></table>` : '<p class="summary-text">No application data available.</p>'}
    </div>
  </div>

  <div class="section">
    <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.toggle').classList.toggle('open')">
      <h2>Category Breakdown</h2>
      <span class="toggle">▼</span>
    </div>
    <div class="section-body">
      ${categories.length ? `<table><thead><tr><th>Category</th><th>Duration</th><th>%</th><th>Distribution</th></tr></thead><tbody>${catRows}</tbody></table>` : '<p class="summary-text">No categories available.</p>'}
    </div>
  </div>

  <div class="section">
    <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.toggle').classList.toggle('open')">
      <h2>Summary</h2>
      <span class="toggle">▼</span>
    </div>
    <div class="section-body">
      <p class="summary-text">
        <strong>Top App:</strong> ${summary.topApp ?? 'N/A'}<br>
        <strong>Applications Tracked:</strong> ${summary.appCount}<br>
        <strong>Active Ratio:</strong> ${summary.totalTime ? Math.round((summary.activeTime / summary.totalTime) * 100) : 0}%<br>
        <strong>Report Generated:</strong> ${now}
      </p>
    </div>
  </div>

  <div class="footer">
    Generated by Veyon & ActivityWatch Dashboard &mdash; ${now}
  </div>
</div>
<script>
document.querySelectorAll('.section-body').forEach(el => el.classList.add('hidden'));
document.querySelectorAll('.section-header')[0]?.click();
document.querySelectorAll('.section-header')[1]?.click();
function sortTable(col) {
  const tbody = document.getElementById('apps-tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const ascending = tbody.dataset.sort === col + 'asc' ? false : true;
  tbody.dataset.sort = col + (ascending ? 'asc' : 'desc');
  rows.sort((a, b) => {
    const va = a.cells[col + 1]?.textContent?.trim() || '0';
    const vb = b.cells[col + 1]?.textContent?.trim() || '0';
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return ascending ? na - nb : nb - na;
    return ascending ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  rows.forEach(r => tbody.appendChild(r));
}
</script>
</body>
</html>`;
  }

  async importData(query: ActivityQuery): Promise<ImportResponse> {
    const { start, end, instanceId } = query;
    const timeRange = this.getTimeRange('day', start, end);
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);
    const days: ImportResult[] = [];
    let totalEvents = 0;

    const current = new Date(startDate);
    while (current <= endDate) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const dateStr = dayStart.toISOString().split('T')[0] ?? '';

      const dayQuery: ActivityQuery = {
        start: dayStart.toISOString(),
        end: dayEnd.toISOString(),
        instanceId,
      };

      const metrics = await this.getProductivityMetrics(dayQuery);

      const dayData = {
        date: dateStr,
        totalActive: metrics.totalActiveTime,
        totalAfk: metrics.totalAFKTime,
        apps: JSON.stringify(metrics.topApplications),
        hourlyData: JSON.stringify(metrics.hourlyBreakdown),
        categories: JSON.stringify(metrics.categorizedTime),
      };

      await prisma.importedActivityData.upsert({
        where: { date_instanceId: { date: dateStr, instanceId: instanceId ?? '' } },
        update: dayData,
        create: { instanceId: instanceId ?? '', ...dayData },
      });

      days.push({
        date: dateStr,
        totalActive: metrics.totalActiveTime,
        totalAfk: metrics.totalAFKTime,
        appCount: metrics.topApplications.length,
        categoryCount: metrics.categorizedTime.length,
      });

      totalEvents += metrics.topApplications.reduce((s, a) => s + a.duration, 0);

      current.setDate(current.getDate() + 1);
    }

    return { days, totalEvents };
  }

  async getImportedData(query: ActivityQuery) {
    const { start, end, period = 'day', instanceId } = query;
    const timeRange = this.getTimeRange(period, start, end);
    const startDate = timeRange.start.split('T')[0] ?? '';
    const endDate = timeRange.end.split('T')[0] ?? '';

    const rows = await prisma.importedActivityData.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(instanceId ? { instanceId } : {}),
      },
      orderBy: { date: 'asc' },
    });

    return rows.map(r => ({
      date: r.date,
      totalActive: r.totalActive,
      totalAfk: r.totalAfk,
      apps: JSON.parse(r.apps),
      hourlyData: JSON.parse(r.hourlyData),
      categories: JSON.parse(r.categories),
    }));
  }

  private getTimeRange(
    period: PeriodType,
    start?: string,
    end?: string,
  ): { start: string; end: string } {
    const now = new Date();
    const endTime = end ? new Date(end) : now;

    let startTime: Date;
    if (start) {
      startTime = new Date(start);
    } else {
      startTime = new Date(now);
      switch (period) {
        case 'day':
          startTime.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startTime.setDate(startTime.getDate() - startTime.getDay());
          startTime.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startTime.setDate(1);
          startTime.setHours(0, 0, 0, 0);
          break;
        default:
          startTime.setHours(0, 0, 0, 0);
      }
    }

    return {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    };
  }

  private calculateFocusTime(apps: ApplicationUsage[], totalMinutes: number): number {
    const productiveApps = ['code', 'terminal', 'browser', 'office', 'idea', 'visual studio'];
    const focusMinutes = apps
      .filter((app) => productiveApps.some((p) => app.app.toLowerCase().includes(p)))
      .reduce((sum, app) => sum + app.duration, 0);
    return Math.min(focusMinutes, totalMinutes);
  }

  private async categorizeApps(apps: ApplicationUsage[]): Promise<CategorizedTime[]> {
    const rules = await prisma.categoryRule.findMany({
      where: { isActive: true, type: 'app' },
      orderBy: { priority: 'desc' },
    });

    const categoryMap = new Map<string, number>();
    const categoryColors: Record<string, string> = {
      development: '#3B82F6',
      communication: '#10B981',
      browsing: '#F59E0B',
      entertainment: '#EF4444',
      productivity: '#8B5CF6',
      design: '#EC4899',
      other: '#6B7280',
    };

    for (const app of apps) {
      let categorized = false;
      for (const rule of rules) {
        if (app.app.toLowerCase().includes(rule.pattern.toLowerCase())) {
          categoryMap.set(rule.category, (categoryMap.get(rule.category) ?? 0) + app.duration);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        categoryMap.set('other', (categoryMap.get('other') ?? 0) + app.duration);
      }
    }

    const total = [...categoryMap.values()].reduce((a, b) => a + b, 0) || 1;
    return [...categoryMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([category, duration]) => ({
        category,
        duration,
        percentage: Math.round((duration / total) * 100),
        color: categoryColors[category.toLowerCase()] ?? '#6B7280',
      }));
  }
}

export const activityWatchService = new ActivityWatchService();
