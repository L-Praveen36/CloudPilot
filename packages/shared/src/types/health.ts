export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface ServiceHealth {
  status: HealthStatus;
  message?: string;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: HealthStatus;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
  };
}
