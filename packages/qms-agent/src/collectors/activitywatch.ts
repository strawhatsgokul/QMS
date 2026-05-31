import axios from 'axios';
import { logger } from '../logger.js';

export interface ActivityWatchStatus {
  status: 'online' | 'offline';
  currentWindow?: string;
  afkStatus?: string;
}

export async function checkActivityWatch(awUrl?: string): Promise<ActivityWatchStatus> {
  const baseUrl = awUrl || 'http://localhost:5600/api';
  try {
    const response = await axios.get(`${baseUrl}/0/buckets`, { timeout: 5000 });
    const buckets = response.data as Record<string, { type: string }>;
    if (!buckets || typeof buckets !== 'object') {
      return { status: 'offline' };
    }

    let currentWindow: string | undefined;
    let afkStatus: string | undefined;

    for (const [key, bucket] of Object.entries(buckets)) {
      if (bucket.type === 'currentwindow') {
        try {
          const events = await axios.get(`${baseUrl}/0/buckets/${key}/events?limit=1`, { timeout: 3000 });
          const eventData = events.data as Array<{ data: { app?: string; title?: string } }>;
          if (eventData?.length > 0) {
            currentWindow = eventData[0]?.data?.app || eventData[0]?.data?.title || 'unknown';
          }
        } catch { /* ignore */ }
      }
      if (bucket.type === 'afkstatus') {
        try {
          const events = await axios.get(`${baseUrl}/0/buckets/${key}/events?limit=1`, { timeout: 3000 });
          const eventData = events.data as Array<{ data: { status?: string } }>;
          if (eventData?.length > 0) {
            afkStatus = eventData[0]?.data?.status || 'unknown';
          }
        } catch { /* ignore */ }
      }
    }

    return { status: 'online', currentWindow, afkStatus };
  } catch (err) {
    logger.warn('ActivityWatch is offline');
    return { status: 'offline' };
  }
}
