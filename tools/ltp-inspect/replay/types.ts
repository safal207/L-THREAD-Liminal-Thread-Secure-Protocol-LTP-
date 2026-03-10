export interface ReplayStep {
  index: number;
  id: string;
  status: 'admissible' | 'drift' | 'rejected' | 'unknown';
  text?: string;
  timestamp?: string;
  chunk_id?: string;
}
