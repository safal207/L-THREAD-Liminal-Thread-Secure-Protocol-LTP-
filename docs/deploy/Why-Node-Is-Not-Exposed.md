# Why Node Is Not Exposed

## Philosophy: Hard Non-Exposure

In Fintech and regulated environments, accidental exposure of internal infrastructure to the public internet is a critical risk. The LTP Node (v0.1) adopts a "Hard Non-Exposure" philosophy to prevent this class of configuration errors.

## Default Behavior

By default, the LTP Node:

1.  **Binds to 127.0.0.1**: The node listens only on the loopback interface. It is physically impossible to reach it from an external network unless a reverse proxy is explicitly configured.
2.  **Panics on 0.0.0.0**: If you attempt to configure `LTP_NODE_ADDR=0.0.0.0:7070` (bind to all interfaces) without an explicit override flag, the node will **crash immediately** on startup.

## Proxy Safety

When running behind a load balancer or reverse proxy (e.g., Nginx, AWS ALB), you typically set `TRUST_PROXY=true` to correctly resolve client IPs.

However, blind trust in `X-Forwarded-For` headers is a security vulnerability if the node is accidentally exposed directly.

**Safety Mechanism**:
*   If `TRUST_PROXY=true` is set, you **MUST** also provide `LTP_ALLOW_PROXY_CIDR` (e.g., `10.0.0.0/8,172.16.0.0/12`).
*   The node will reject connections from any peer IP not in the allowed CIDR list, even if `TRUST_PROXY` is on.
*   If `LTP_ALLOW_PROXY_CIDR` is missing, the node will panic on startup.

## Overrides (Not Recommended)

If you absolutely must expose the node directly (e.g., for development in a container where the network is isolated), you can set:

```bash
LTP_ALLOW_UNSAFE_EXPOSE=true
```

This acknowledges the risk and bypasses the 0.0.0.0 panic.
