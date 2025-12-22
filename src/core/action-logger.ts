/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { encrypt, decrypt } from './security-utils';

export interface ActionRecord {
    id: string;
    timestamp: number;
    tool: string;
    args: any;
    result: any;
    duration: number;
    success: boolean;
}

export class ActionLogger {
    private history: ActionRecord[] = [];
    private maxHistory = 1000;
    private historyPath: string;
    private encryptionKey: string;

    constructor(historyPath?: string) {
        // Use a secure user directory instead of /tmp by default
        const homeDir = os.homedir();
        const baseDir = path.join(homeDir, '.ultramac-mcp', 'history');
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
        }
        this.historyPath = historyPath || path.join(baseDir, 'action-history.json');
        
        // Derive encryption key (32 bytes / 64 hex chars)
        const secret = process.env.ULTRAMAC_MCP_HISTORY_SECRET || 'dev_secret_key_change_in_production';
        this.encryptionKey = crypto.createHash('sha256').update(secret).digest('hex');
        
        this.loadHistory();
        this.applyRetentionPolicy();
    }

    private applyRetentionPolicy(): void {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const originalLength = this.history.length;
        this.history = this.history.filter(record => record.timestamp > sevenDaysAgo);
        
        if (this.history.length < originalLength) {
            console.log(`[ActionHistory] Removed ${originalLength - this.history.length} expired records (7-day retention)`);
            this.persistHistory();
        }
    }

    log(tool: string, args: any, result: any, duration: number, success: boolean): ActionRecord {
        const record: ActionRecord = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            tool,
            args,
            result,
            duration,
            success
        };

        this.history.push(record);
        
        // Trim to maxHistory
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }

        // Persist asynchronously
        this.persistHistory();
        
        return record;
    }

    getHistory(limit?: number): ActionRecord[] {
        if (limit) {
            return this.history.slice(-limit);
        }
        return [...this.history];
    }

    getById(id: string): ActionRecord | undefined {
        return this.history.find(r => r.id === id);
    }

    removeRecord(id: string): boolean {
        const index = this.history.findIndex(r => r.id === id);
        if (index !== -1) {
            this.history.splice(index, 1);
            this.persistHistory();
            return true;
        }
        return false;
    }

    clear(): void {
        this.history = [];
        this.persistHistory();
    }

    public async persistHistory(): Promise<void> {
        try {
            const jsonData = JSON.stringify(this.history, null, 2);
            const encryptedData = encrypt(jsonData, this.encryptionKey);
            fs.writeFileSync(this.historyPath, encryptedData);
        } catch (e) {
            console.error('Failed to persist action history:', e);
        }
    }

    private loadHistory(): void {
        try {
            if (fs.existsSync(this.historyPath)) {
                const encryptedData = fs.readFileSync(this.historyPath, 'utf-8');
                try {
                    const jsonData = decrypt(encryptedData, this.encryptionKey);
                    this.history = JSON.parse(jsonData);
                } catch (decryptError) {
                    console.warn('[ActionHistory] Failed to decrypt history, starting fresh:', decryptError);
                    this.history = [];
                }
            }
        } catch (e) {
            console.warn('Failed to load action history, starting fresh:', e);
            this.history = [];
        }
    }
}

export const actionLogger = new ActionLogger();
