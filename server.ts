import express from 'express';
import path from 'path';
import http from 'http';

const PORT = 3000;
const app = express();

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

const backends: Backend[] = [
  { id: 'backend-1', port: 4001, healthy: true, forcedDown: false, activeConnections: 0, totalRequests: 0 },
  { id: 'backend-2', port: 4002, healthy: true, forcedDown: false, activeConnections: 0, totalRequests: 0 },
  { id: 'backend-3', port: 4003, healthy: true, forcedDown: false, activeConnections: 0, totalRequests: 0 },
];

let algorithm: 'round-robin' | 'least-connections' = 'round-robin';
let totalServed = 0;
let rrIndex = 0;

// SSE Broadcasting
let clients: express.Response[] = [];
let pendingBroadcast = false;

function getState(): LbState {
  return { algorithm, backends, totalServed };
}

function broadcastState() {
  if (pendingBroadcast) return;
  pendingBroadcast = true;
  setTimeout(() => {
    const data = `data: ${JSON.stringify(getState())}\n\n`;
    for (const c of clients) {
      c.write(data);
    }
    pendingBroadcast = false;
  }, 100);
}

// Mock Servers
[4001, 4002, 4003].forEach((port) => {
  const mockApp = express();
  
  mockApp.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  mockApp.all('*', (req, res) => {
    // Simulate variable backend processing time (50ms - 250ms)
    const delay = Math.floor(Math.random() * 200) + 50;
    setTimeout(() => {
      res.json({ message: `Served by backend on port ${port}`, port, delay });
    }, delay);
  });

  mockApp.listen(port, '127.0.0.1', () => {
    console.log(`Backend listening locally on ${port}`);
  });
});

// Health Checks
setInterval(() => {
  let stateChanged = false;
  
  Promise.all(backends.map(async (b) => {
    if (b.forcedDown) {
      if (b.healthy !== false) {
        b.healthy = false;
        stateChanged = true;
      }
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const resp = await fetch(`http://127.0.0.1:${b.port}/health`, { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      const isHealthy = resp.ok;
      if (b.healthy !== isHealthy) {
        b.healthy = isHealthy;
        stateChanged = true;
      }
    } catch (e) {
      if (b.healthy !== false) {
        b.healthy = false;
        stateChanged = true;
      }
    }
  })).then(() => {
    if (stateChanged) broadcastState();
  });
}, 3000); // Check every 3 seconds

// Load Balancing Logic
function getTargetBackend(): Backend | null {
  const healthyBackends = backends.filter((b) => b.healthy);
  if (healthyBackends.length === 0) return null;

  if (algorithm === 'round-robin') {
    const target = healthyBackends[rrIndex % healthyBackends.length];
    rrIndex++;
    return target;
  } else if (algorithm === 'least-connections') {
    return healthyBackends.reduce((min, b) => 
      b.activeConnections < min.activeConnections ? b : min, 
      healthyBackends[0]
    );
  }
  return null;
}

// Middleware to parse JSON for our API
app.use(express.json());

// Load Balancer Proxy Endpoints
app.all('/api/lb/proxy', (req, res) => {
  const target = getTargetBackend();
  if (!target) {
    return res.status(503).json({ error: 'Service Unavailable: No healthy backends' });
  }

  target.activeConnections++;
  broadcastState();

  const options = {
    hostname: '127.0.0.1',
    port: target.port,
    path: '/', // our mock servers respond to everything
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${target.port}` }, // remove external host
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
    proxyRes.on('end', () => {
      target.activeConnections--;
      target.totalRequests++;
      totalServed++;
      broadcastState();
    });
  });

  req.pipe(proxyReq, { end: true });
  
  proxyReq.on('error', (err) => {
    target.activeConnections--;
    broadcastState();
    res.status(502).json({ error: 'Bad Gateway' });
  });
});

// API Routes
app.get('/api/lb/state', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  clients.push(res);
  res.write(`data: ${JSON.stringify(getState())}\n\n`);

  req.on('close', () => {
    clients = clients.filter((c) => c !== res);
  });
});

app.post('/api/lb/backend/:id/toggle', (req, res) => {
  const b = backends.find((b) => b.id === req.params.id);
  if (b) {
    b.forcedDown = !b.forcedDown;
    if (b.forcedDown) b.healthy = false;
    broadcastState();
    res.json({ success: true, backend: b });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/lb/algorithm', (req, res) => {
  if (req.body.algorithm === 'round-robin' || req.body.algorithm === 'least-connections') {
    algorithm = req.body.algorithm;
    broadcastState();
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid algorithm' });
  }
});

app.post('/api/lb/reset', (req, res) => {
  totalServed = 0;
  backends.forEach(b => {
    b.totalRequests = 0;
  });
  broadcastState();
  res.json({ success: true });
});

// Vite Middleware & Static serve
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
