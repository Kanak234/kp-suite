import * as os from 'os';
import { EventEmitter } from 'vscode';
import { Logger } from '@kanak-prabhakar/shared/types';

export interface SystemMetrics {
  cpuUsage: number; // percentage 0-100
  memoryTotal: number; // bytes
  memoryFree: number; // bytes
  memoryUsagePercent: number; // 0-100
  uptime: number; // seconds
  loadAvg: number[]; // 1, 5, 15 min
  processMemory: NodeJS.MemoryUsage;
}

export class HealthMonitor {
  private readonly logger: Logger;
  private readonly _onMetricsUpdated = new EventEmitter<SystemMetrics>();
  public readonly onMetricsUpdated = this._onMetricsUpdated.event;
  
  private intervalId?: NodeJS.Timeout;
  private lastCpu: { idle: number, total: number };

  constructor(logger: Logger) {
    this.logger = logger;
    this.lastCpu = this.getCpuUsageRaw();
  }

  start(intervalMs: number = 5000): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.logger.info(`Starting health monitor with interval ${intervalMs}ms`);
    this.intervalId = setInterval(() => this.collectMetrics(), intervalMs);
    
    // Initial collection
    this.collectMetrics();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Stopped health monitor');
    }
  }

  dispose(): void {
    this.stop();
    this._onMetricsUpdated.dispose();
  }

  private collectMetrics(): void {
    try {
      const memTotal = os.totalmem();
      const memFree = os.freemem();
      const memUsed = memTotal - memFree;
      
      const currentCpu = this.getCpuUsageRaw();
      const idleDiff = currentCpu.idle - this.lastCpu.idle;
      const totalDiff = currentCpu.total - this.lastCpu.total;
      const cpuUsage = totalDiff === 0 ? 0 : 100 - Math.floor(100 * idleDiff / totalDiff);
      
      this.lastCpu = currentCpu;

      const metrics: SystemMetrics = {
        cpuUsage,
        memoryTotal: memTotal,
        memoryFree: memFree,
        memoryUsagePercent: Math.floor((memUsed / memTotal) * 100),
        uptime: os.uptime(),
        loadAvg: os.loadavg(),
        processMemory: process.memoryUsage()
      };

      this._onMetricsUpdated.fire(metrics);
    } catch (err) {
      this.logger.error('Failed to collect health metrics', { error: String(err) });
    }
  }

  private getCpuUsageRaw(): { idle: number, total: number } {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }
    
    return { idle, total };
  }
}
