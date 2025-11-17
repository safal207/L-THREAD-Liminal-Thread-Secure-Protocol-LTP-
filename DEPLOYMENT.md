# LTP Deployment Guide

**Version:** 0.3  
**Last Updated:** 2025-01-15

This guide covers deployment strategies for LTP (Liminal Thread Protocol) servers and clients in various environments.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Server Deployment](#server-deployment)
3. [Client Integration](#client-integration)
4. [Production Considerations](#production-considerations)
5. [Scaling Strategies](#scaling-strategies)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security](#security)

---

## Quick Start

### Prerequisites

- **Node.js 18+** (for JavaScript server/client)
- **Python 3.9+** (for Python client)
- **Elixir 1.14+** (for Elixir server/client)
- **Rust 1.70+** (for Rust server/client)
- **WebSocket-capable infrastructure**

### Minimal Server Setup

**JavaScript/Node.js:**

```bash
cd examples/js-minimal-server
npm install
npm start
# Server runs on ws://localhost:8080
```

**Elixir:**

```bash
cd examples/elixir-server
mix deps.get
mix run --no-halt
# Server runs on ws://localhost:8080
```

**Rust:**

```bash
cd examples/rust-server
cargo run
# Server runs on ws://localhost:8080
```

---

## Server Deployment

### 1. Standalone Server

#### JavaScript/Node.js

**Development:**

```bash
cd examples/js-minimal-server
npm install
npm start
```

**Production with PM2:**

```bash
npm install -g pm2
pm2 start index.js --name ltp-server
pm2 save
pm2 startup
```

**Docker:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
```

```bash
docker build -t ltp-server .
docker run -p 8080:8080 ltp-server
```

#### Elixir

**Development:**

```bash
cd examples/elixir-server
mix deps.get
MIX_ENV=dev mix run --no-halt
```

**Production Release:**

```bash
MIX_ENV=prod mix release
_build/prod/rel/ltp_server/bin/ltp_server start
```

**Docker:**

```dockerfile
FROM elixir:1.14-alpine
WORKDIR /app
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
COPY . .
RUN MIX_ENV=prod mix release
EXPOSE 8080
CMD ["_build/prod/rel/ltp_server/bin/ltp_server", "start"]
```

#### Rust

**Development:**

```bash
cd examples/rust-server
cargo run
```

**Production Build:**

```bash
cargo build --release
./target/release/ltp-server-example
```

**Docker:**

```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/ltp-server-example /usr/local/bin/ltp-server
EXPOSE 8080
CMD ["ltp-server"]
```

### 2. Kubernetes Deployment

**Deployment YAML:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ltp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ltp-server
  template:
    metadata:
      labels:
        app: ltp-server
    spec:
      containers:
      - name: ltp-server
        image: ltp-server:0.3
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ltp-server
spec:
  selector:
    app: ltp-server
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
```

**Ingress for WebSocket:**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ltp-server-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/websocket-services: "ltp-server"
spec:
  rules:
  - host: ltp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ltp-server
            port:
              number: 80
```

### 3. Cloud Platform Deployment

#### AWS (Elastic Beanstalk / ECS)

**Elastic Beanstalk:**

```bash
eb init -p node.js ltp-server
eb create ltp-server-prod
eb deploy
```

**ECS Task Definition:**

```json
{
  "family": "ltp-server",
  "containerDefinitions": [{
    "name": "ltp-server",
    "image": "ltp-server:0.3",
    "portMappings": [{
      "containerPort": 8080,
      "protocol": "tcp"
    }],
    "memory": 512,
    "cpu": 256
  }]
}
```

#### Google Cloud Platform (Cloud Run)

```bash
gcloud run deploy ltp-server \
  --source examples/js-minimal-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

#### Azure (Container Instances)

```bash
az container create \
  --resource-group ltp-rg \
  --name ltp-server \
  --image ltp-server:0.3 \
  --ports 8080 \
  --dns-name-label ltp-server
```

---

## Client Integration

### JavaScript/TypeScript

**Browser:**

```html
<script type="module">
  import { LtpClient } from 'https://cdn.example.com/ltp-client.js';
  
  const client = new LtpClient('wss://ltp.example.com', {
    clientId: 'web-client-1'
  });
  
  await client.connect();
</script>
```

**Node.js:**

```bash
npm install @liminal/ltp-client
```

```typescript
import { LtpClient } from '@liminal/ltp-client';

const client = new LtpClient('wss://ltp.example.com', {
  clientId: 'node-client-1'
});

await client.connect();
```

### Python

**Installation:**

```bash
pip install ltp-client
# or from source
cd sdk/python
pip install -e .
```

**Usage:**

```python
from ltp_client import LtpClient

client = LtpClient('wss://ltp.example.com', client_id='python-client-1')
await client.connect()
```

### Elixir

**Add to mix.exs:**

```elixir
defp deps do
  [
    {:ltp_elixir, path: "../sdk/elixir"}
  ]
end
```

**Usage:**

```elixir
{:ok, pid} = LTP.Client.start_link(%{
  url: "wss://ltp.example.com",
  client_id: "elixir-client-1"
})
```

### Rust

**Add to Cargo.toml:**

```toml
[dependencies]
ltp-client = { path = "../sdk/rust/ltp-client" }
```

**Usage:**

```rust
use ltp_client::LtpClient;

let mut client = LtpClient::new("wss://ltp.example.com", "rust-client-1");
client.connect().await?;
```

---

## Production Considerations

### 1. TLS/SSL (WSS)

**Always use WSS in production!**

```nginx
# Nginx configuration
server {
    listen 443 ssl;
    server_name ltp.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

### 2. Thread Persistence

**Server-side thread storage:**

- **In-memory:** Fast but lost on restart (development only)
- **Redis:** Distributed, persistent (recommended for production)
- **PostgreSQL/MySQL:** Relational storage for complex queries
- **MongoDB:** Document storage for flexible schemas

**Example Redis storage:**

```javascript
// JavaScript server example
const redis = require('redis');
const client = redis.createClient();

async function getThread(threadId) {
  return await client.get(`ltp:thread:${threadId}`);
}

async function saveThread(threadId, data) {
  await client.setex(`ltp:thread:${threadId}`, 3600, JSON.stringify(data));
}
```

### 3. Connection Limits

**Per-server limits:**

```javascript
// JavaScript example
const MAX_CONNECTIONS = 10000;
let connectionCount = 0;

wsServer.on('connection', (ws) => {
  if (connectionCount >= MAX_CONNECTIONS) {
    ws.close(1008, 'Server at capacity');
    return;
  }
  connectionCount++;
  
  ws.on('close', () => {
    connectionCount--;
  });
});
```

### 4. Heartbeat Configuration

**Recommended settings:**

```javascript
// Client configuration
const client = new LtpClient(url, {
  heartbeat: {
    intervalMs: 30000,  // 30 seconds
    timeoutMs: 90000    // 90 seconds (3x interval)
  }
});
```

---

## Scaling Strategies

### 1. Horizontal Scaling

**Load Balancing:**

```nginx
upstream ltp_servers {
    least_conn;
    server ltp-server-1:8080;
    server ltp-server-2:8080;
    server ltp-server-3:8080;
}

server {
    location / {
        proxy_pass http://ltp_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Sticky Sessions (if needed):**

```nginx
upstream ltp_servers {
    ip_hash;  # Sticky sessions by IP
    server ltp-server-1:8080;
    server ltp-server-2:8080;
}
```

### 2. Thread Distribution

**Shared thread storage (Redis):**

```javascript
// All servers share thread state via Redis
const redis = require('redis');
const pubsub = redis.createClient();

// When thread state changes, publish to all servers
async function updateThread(threadId, data) {
  await redis.set(`ltp:thread:${threadId}`, JSON.stringify(data));
  await pubsub.publish('ltp:thread:update', JSON.stringify({ threadId, data }));
}
```

### 3. Message Broadcasting

**Redis Pub/Sub for cross-server messaging:**

```javascript
// Server 1: Publish message
await redis.publish('ltp:messages', JSON.stringify({
  threadId: 'thread-123',
  message: envelope
}));

// All servers: Subscribe
redis.subscribe('ltp:messages');
redis.on('message', (channel, message) => {
  const { threadId, message: envelope } = JSON.parse(message);
  // Forward to connected client if on this server
  forwardToClient(threadId, envelope);
});
```

---

## Monitoring & Observability

### 1. Metrics

**Key metrics to track:**

- Active connections
- Messages per second
- Handshake success/failure rate
- Heartbeat timeout rate
- Thread count
- Average message latency
- Error rate

**Prometheus example:**

```javascript
const prometheus = require('prom-client');

const activeConnections = new prometheus.Gauge({
  name: 'ltp_active_connections',
  help: 'Number of active WebSocket connections'
});

const messagesTotal = new prometheus.Counter({
  name: 'ltp_messages_total',
  help: 'Total number of messages processed',
  labelNames: ['type']
});

// In your server
wsServer.on('connection', () => {
  activeConnections.inc();
});

wsServer.on('message', (message) => {
  messagesTotal.inc({ type: message.type });
});
```

### 2. Logging

**Structured logging:**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'ltp-server.log' })
  ]
});

logger.info('LTP Server started', {
  port: 8080,
  version: '0.3.0',
  timestamp: new Date().toISOString()
});
```

### 3. Health Checks

**Health endpoint:**

```javascript
// Add HTTP health check endpoint
const http = require('http');

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      connections: connectionCount,
      uptime: process.uptime()
    }));
  }
});

healthServer.listen(8081);
```

---

## Security

### 1. Authentication

**Token-based authentication:**

```javascript
// Client sends auth token in handshake metadata
const client = new LtpClient(url, {
  clientId: 'client-1',
  metadata: {
    auth_token: 'bearer-token-here'
  }
});

// Server validates token
wsServer.on('connection', async (ws, req) => {
  const token = extractToken(req);
  if (!await validateToken(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  // Proceed with connection
});
```

### 2. Rate Limiting

**Per-client rate limiting:**

```javascript
const rateLimit = new Map();

function checkRateLimit(clientId) {
  const now = Date.now();
  const window = 60000; // 1 minute
  const limit = 100; // 100 messages per minute
  
  if (!rateLimit.has(clientId)) {
    rateLimit.set(clientId, { count: 0, resetAt: now + window });
  }
  
  const clientLimit = rateLimit.get(clientId);
  if (now > clientLimit.resetAt) {
    clientLimit.count = 0;
    clientLimit.resetAt = now + window;
  }
  
  if (clientLimit.count >= limit) {
    return false; // Rate limit exceeded
  }
  
  clientLimit.count++;
  return true;
}
```

### 3. Input Validation

**Validate all incoming messages:**

```javascript
function validateEnvelope(envelope) {
  if (!envelope.type || !envelope.thread_id) {
    return false;
  }
  
  if (envelope.payload && typeof envelope.payload !== 'object') {
    return false;
  }
  
  // Additional validation...
  return true;
}
```

---

## Troubleshooting

### Common Issues

**1. Connection drops frequently**

- Check heartbeat configuration
- Verify network stability
- Review server logs for errors
- Check for timeout settings

**2. Thread not resuming**

- Verify thread_id persistence
- Check storage backend connectivity
- Review handshake_reject reasons

**3. High memory usage**

- Implement connection limits
- Add message size limits
- Review thread cleanup policies
- Monitor for memory leaks

---

## Additional Resources

- [LTP Protocol Specification](../specs/)
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Reference](./API.md) (coming soon)
- [Examples](../examples/)

---

**Need help?** Open an issue on GitHub or check the documentation.

