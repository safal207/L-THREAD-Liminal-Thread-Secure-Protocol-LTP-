export type MutationId =
  | "allow-security-downgrade"
  | "accept-unknown-required-capability"
  | "mutate-state-on-reject"
  | "accept-replayed-nonce";

export interface MutationOutcome {
  mutation_id: MutationId;
  killed: boolean;
  detector: string;
}

interface SecurityState {
  chain_head: string;
  replay_nonces: string[];
}

function detectsDowngrade(selectVersion: (floor: string, offered: string) => string | null): boolean {
  return selectVersion("0.6.0", "0.3.0") === null;
}

function detectsUnknownRequired(check: (known: Set<string>, required: string) => boolean): boolean {
  return check(new Set(["canonical-envelope-v1"]), "future-required") === false;
}

function detectsMutationOnReject(reject: (state: SecurityState) => void): boolean {
  const state: SecurityState = { chain_head: "abc", replay_nonces: ["n-1"] };
  const before = JSON.stringify(state);
  reject(state);
  return JSON.stringify(state) === before;
}

function detectsReplay(accept: (seen: Set<string>, nonce: string) => boolean): boolean {
  return accept(new Set(["nonce-1"]), "nonce-1") === false;
}

export function runMutationCampaign(): MutationOutcome[] {
  const outcomes: MutationOutcome[] = [];

  const downgradeMutant = (_floor: string, offered: string): string => offered;
  outcomes.push({
    mutation_id: "allow-security-downgrade",
    killed: !detectsDowngrade(downgradeMutant),
    detector: "minimum-version security floor",
  });

  const unknownRequiredMutant = (_known: Set<string>, _required: string): boolean => true;
  outcomes.push({
    mutation_id: "accept-unknown-required-capability",
    killed: !detectsUnknownRequired(unknownRequiredMutant),
    detector: "unknown required capabilities fail closed",
  });

  const mutationOnRejectMutant = (state: SecurityState): void => {
    state.chain_head = "corrupted";
  };
  outcomes.push({
    mutation_id: "mutate-state-on-reject",
    killed: !detectsMutationOnReject(mutationOnRejectMutant),
    detector: "rejection preserves committed state",
  });

  const replayMutant = (_seen: Set<string>, _nonce: string): boolean => true;
  outcomes.push({
    mutation_id: "accept-replayed-nonce",
    killed: !detectsReplay(replayMutant),
    detector: "replayed nonce remains rejected",
  });

  return outcomes;
}
