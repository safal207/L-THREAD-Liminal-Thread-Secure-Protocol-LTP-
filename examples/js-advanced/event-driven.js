/**
 * LTP Event-Driven Architecture Example
 * 
 * Demonstrates:
 * - Event-driven patterns
 * - Message routing
 * - State machine integration
 * - Event aggregation
 */

const { LtpClient } = require('../../sdk/js/dist/index');

class EventDrivenLtpClient {
  constructor(url, options = {}) {
    this.url = url;
    this.clientId = options.clientId || `event-client-${Date.now()}`;
    this.eventHandlers = new Map();
    this.state = {
      connected: false,
      threadId: null,
      sessionId: null,
      lastEventTime: null,
    };

    this.client = new LtpClient(url, {
      clientId: this.clientId,
      defaultContextTag: options.defaultContextTag || 'event_driven',
    }, {
      onConnected: (threadId, sessionId) => {
        this.state.connected = true;
        this.state.threadId = threadId;
        this.state.sessionId = sessionId;
        this.emit('connected', { threadId, sessionId });
      },
      
      onDisconnected: () => {
        this.state.connected = false;
        this.emit('disconnected', {});
      },
      
      onError: (error) => {
        this.emit('error', error);
      },
      
      onStateUpdate: (payload) => {
        this.emit('state_update', payload);
        this.routeMessage('state_update', payload);
      },
      
      onEvent: (payload) => {
        this.state.lastEventTime = Date.now();
        this.emit('event', payload);
        this.routeMessage('event', payload);
      },
    });
  }

  // Event emitter pattern
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  // Route messages based on payload kind or event type
  routeMessage(type, payload) {
    if (type === 'state_update') {
      const kind = payload.kind;
      this.emit(`state_update:${kind}`, payload);
    } else if (type === 'event') {
      const eventType = payload.event_type;
      this.emit(`event:${eventType}`, payload);
    }
  }

  async connect() {
    await this.client.connect();
  }

  async sendEvent(eventType, data, contextTag = null) {
    await this.client.sendEvent(eventType, data, {
      contextTag: contextTag || 'event_driven',
    });
  }

  async sendStateUpdate(payload, contextTag = null) {
    await this.client.sendStateUpdate(payload, {
      contextTag: contextTag || 'event_driven',
    });
  }

  async disconnect() {
    await this.client.disconnect();
  }

  getState() {
    return { ...this.state };
  }
}

// Example: State machine integration
class UserSessionStateMachine {
  constructor(ltpClient) {
    this.ltpClient = ltpClient;
    this.currentState = 'idle';
    this.transitions = {
      idle: ['authenticating', 'disconnected'],
      authenticating: ['authenticated', 'failed'],
      authenticated: ['active', 'idle'],
      active: ['idle', 'disconnected'],
      failed: ['idle'],
      disconnected: ['idle'],
    };

    // Listen to LTP events
    ltpClient.on('connected', () => {
      this.transition('authenticating');
    });

    ltpClient.on('disconnected', () => {
      this.transition('disconnected');
    });

    ltpClient.on('event:user_login', () => {
      if (this.currentState === 'authenticating') {
        this.transition('authenticated');
      }
    });

    ltpClient.on('event:user_logout', () => {
      if (this.currentState === 'active') {
        this.transition('idle');
      }
    });
  }

  transition(newState) {
    if (this.transitions[this.currentState]?.includes(newState)) {
      const oldState = this.currentState;
      this.currentState = newState;
      
      // Send state transition event
      this.ltpClient.sendEvent('state_transition', {
        from: oldState,
        to: newState,
        timestamp: Date.now(),
      });

      console.log(`State transition: ${oldState} → ${newState}`);
    } else {
      console.warn(`Invalid transition: ${this.currentState} → ${newState}`);
    }
  }
}

// Example usage
async function main() {
  const client = new EventDrivenLtpClient('ws://localhost:8080', {
    clientId: 'event-driven-example',
  });

  // Set up event handlers
  client.on('connected', ({ threadId, sessionId }) => {
    console.log(`✓ Connected: thread=${threadId}, session=${sessionId}`);
  });

  client.on('state_update:user_activity', (payload) => {
    console.log('User activity update:', payload.data);
  });

  client.on('event:user_action', (payload) => {
    console.log('User action event:', payload.data);
  });

  // Integrate with state machine
  const stateMachine = new UserSessionStateMachine(client);

  try {
    await client.connect();

    // Simulate user actions
    await new Promise(resolve => setTimeout(resolve, 1000));
    await client.sendEvent('user_login', { userId: 'user123' });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await client.sendEvent('user_action', { action: 'click', target: 'button' });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await client.sendStateUpdate({
      kind: 'user_activity',
      data: { page: 'dashboard', timeSpent: 5000 },
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await client.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EventDrivenLtpClient, UserSessionStateMachine };

