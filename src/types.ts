export interface Backend {
  id: string;
  port: number;
  healthy: boolean;
  forcedDown: boolean;
  activeConnections: number;
  totalRequests: number;
}

export interface LbState {
  algorithm: 'round-robin' | 'least-connections';
  backends: Backend[];
  totalServed: number;
}
