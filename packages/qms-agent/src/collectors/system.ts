import si from 'systeminformation';
import os from 'node:os';

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  topProcesses: string;
  hostname: string;
  os: string;
  version: string;
}

export async function collectSystemStats(): Promise<SystemStats> {
  const [cpu, mem, processes, hostname, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.processes(),
    Promise.resolve(os.hostname()),
    si.osInfo(),
  ]);

  const topProcesses = processes.list
    .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
    .slice(0, 10)
    .map(p => ({ name: p.name, cpu: p.cpu, mem: p.mem }));

  return {
    cpuUsage: Math.round(cpu.currentLoad * 10) / 10,
    memoryUsage: Math.round(((mem.total - mem.available) / mem.total) * 100 * 10) / 10,
    memoryTotal: mem.total,
    topProcesses: JSON.stringify(topProcesses),
    hostname,
    os: osInfo.distro,
    version: osInfo.release,
  };
}
