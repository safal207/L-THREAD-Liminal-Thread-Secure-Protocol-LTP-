# LTP Non-Goals

Defining what a protocol *is not* is as important as defining what it *is*. This document clarifies the explicit non-goals of the Liminal Thread Protocol (LTP) to maintain its focus and minimalism.

## 1. No Machine Learning Requirement

LTP does not require machine learning, neural networks, or any form of artificial intelligence to function. While an LTP server (a "node") may use ML to generate its multi-path route responses, the protocol itself is deterministic and agnostic to the implementation details of the node. A simple, rule-based engine is as valid an LTP implementation as a complex neural network.

## 2. No Data Storage or Persistence

LTP is a transport protocol. It is fundamentally stateless. It does not specify, manage, or require any form of data storage, either on the client or the server. The `orientation` and `route_response` frames are ephemeral, representing a snapshot in time. Persistence is the responsibility of the application layer.

## 3. No User Experience (UX) Mandates

LTP provides structured data for orientation and decision-making, but it does not impose any constraints on how that data is rendered or used. A `route_response` could be used to render a complex 3D graph, a simple list of buttons, or fed directly into an autonomous agent with no user interface at all. The presentation layer is entirely outside the scope of the protocol.

## 4. No Central Authority or Control Plane

LTP is designed for decentralized use. There is no central server, registry, or authority required for two LTP-speaking endpoints to communicate. The protocol does not include concepts of global identity, authentication services, or a control plane. It is a peer-to-peer communication pattern, even in a client-server architecture.

## 5. No Monetization at the Protocol Level

The LTP specification will always be free, open, and unencumbered by patents or royalties. The protocol itself includes no mechanisms for billing, metering, or monetization. A healthy commercial ecosystem is expected to form *around* the protocol (e.g., through managed services, consulting, and conformance tooling), but the standard itself remains a neutral public good.
