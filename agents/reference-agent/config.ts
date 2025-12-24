import * as fs from 'fs';
import * as path from 'path';

export class ConfigLoader {
  static getCriticalActions(): string[] {
    // 1. Check Env Var (List)
    if (process.env.LTP_CRITICAL_ACTIONS) {
      return process.env.LTP_CRITICAL_ACTIONS.split(',').map(s => s.trim());
    }

    // 2. Check File
    const filePath = process.env.LTP_CRITICAL_ACTIONS_FILE;
    if (filePath) {
      try {
        const resolvedPath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(resolvedPath)) {
          const content = fs.readFileSync(resolvedPath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            return data;
          }
          if (data.criticalActions && Array.isArray(data.criticalActions)) {
            return data.criticalActions;
          }
        } else {
            console.warn(`[LTP] Config file not found: ${filePath}, falling back to defaults.`);
        }
      } catch (err) {
        console.warn(`[LTP] Failed to load config file: ${err}, falling back to defaults.`);
      }
    }

    // 3. Defaults (Sane Defaults)
    return ['transfer_money', 'delete_data', 'send_email', 'approve_trade', 'modify_system', 'delete_file'];
  }

  static getGloballyBannedActions(): string[] {
      return ['rm -rf', 'format_disk'];
  }
}
