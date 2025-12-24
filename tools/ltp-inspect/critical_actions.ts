export const CRITICAL_ACTIONS = [
  'transfer_money',
  'place_order',
  'send_message',
  'delete_data',
  'grant_access',
  'modify_system',
  'execute_code',
];

export const RECOVERY_ACTIONS = [
  'RECOVERY',
  'PING',
  'STATUS',
  'HANDSHAKE',
];

export const AGENT_RULES = {
  WEB_DIRECT: 'AGENTS.CRIT.WEB_DIRECT',
  NO_CAPABILITY: 'AGENTS.CRIT.NO_CAPABILITY',
  NO_ADMISSIBILITY: 'AGENTS.CRIT.NO_ADMISSIBILITY',
  UNVERIFIED_IDENTITY: 'AGENTS.CRIT.UNVERIFIED_IDENTITY',
};
