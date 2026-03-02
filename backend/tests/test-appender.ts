export class TestAppender {
  private logs: string[] = [];
  /**
   * Capture a log line
   */
  log(line: string): void {
    this.logs.push(line);
  }
  /**
   * Get the most recent log entry
   */
  getLastLog(): string {
    if (this.logs.length === 0) {
      throw new Error("No logs captured");
    }
    return this.logs.at(this.logs.length - 1) as string;
  }
  /**
   * Get all captured logs
   */
  getAllLogs(): string[] {
    return [...this.logs];
  }
  /**
   * Parse the last log as JSON
   */
  getLastLogAsJson(): Record<string, unknown> {
    const log = this.getLastLog();
    try {
      return JSON.parse(log);
    } catch {
      throw new Error(`Failed to parse log as JSON: ${log}`);
    }
  }
  /**
   * Check if any log contains a string
   */
  contains(searchString: string): boolean {
    return this.logs.some((log) => log.includes(searchString));
  }
  /**
   * Clear all captured logs
   */
  clear(): void {
    this.logs = [];
  }
}

// Factory function for creating pino-compatible transport
export function createTestTransport(appender: TestAppender) {
  return {
    write(line: string): void {
      appender.log(line);
    },
  };
}
