
export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentError';
  }
}

export class EnforcementError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = 'EnforcementError';
  }
}

export class IntegrityError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}
