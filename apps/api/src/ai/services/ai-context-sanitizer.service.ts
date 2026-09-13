import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiContextSanitizerService {
  private readonly logger = new Logger(AiContextSanitizerService.name);

  // Maximum allowed character bounds for prompt payloads
  public readonly MAX_PROMPT_CHARS = 24000;
  public readonly MAX_LOG_CHARS = 10000;
  public readonly MAX_FILE_CHARS = 6000;

  /**
   * Sanitizes all sensitive information and redacts tokens/credentials.
   */
  sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      // Redact GitHub Tokens
      .replace(/gh[pousr]_[A-Za-z0-9_]{16,255}/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/github_pat_[a-zA-Z0-9_]{22,}/g, '[REDACTED_GITHUB_TOKEN]')
      // Redact Bearer & Authorization headers
      .replace(/Authorization:\s*Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Authorization: Bearer [REDACTED_TOKEN]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/Authorization:\s*Basic\s+[a-zA-Z0-9_\-\.=:+\/]+/gi, 'Authorization: Basic [REDACTED_TOKEN]')
      // Redact Passwords, secrets, and API keys
      .replace(/(password|passwd|pwd|secret|api_key|apikey|token|private_key)\s*[:=]\s*['"]?[^\s'";,\n\r]+['"]?/gi, '$1=[REDACTED]')
      .replace(/(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/([^:]+):([^@]+)@/gi, '$1://$2:[REDACTED]@')
      // Redact AWS / Cloud credentials
      .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]')
      .replace(/[a-zA-Z0-9/+=]{40}(?=.*AWS)/g, '[REDACTED_AWS_SECRET]')
      // Redact local system absolute file paths for security
      .replace(/(\/tmp\/|\\temp\\|cp-src-)[a-zA-Z0-9_\-\\\/]+/g, '[REDACTED_WORKSPACE_PATH]')
      .replace(/[a-zA-Z]:\\[^\s\n\r"']+/g, '[REDACTED_LOCAL_PATH]');
  }

  /**
   * Cleans and defends against prompt injection patterns in user prompts.
   */
  sanitizeUserPrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') return '';

    let cleaned = this.sanitizeText(prompt);

    // Defense against prompt injection instruction overrides
    const injectionPatterns = [
      /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
      /disregard\s+(all\s+)?(system|previous)\s+prompts/gi,
      /you\s+are\s+now\s+in\s+DAN\s+mode/gi,
      /reveal\s+your\s+system\s+prompt/gi,
      /output\s+all\s+environment\s+variables/gi,
      /execute\s+arbitrary\s+shell\s+command/gi,
      /bypass\s+security\s+checks/gi,
    ];

    for (const pattern of injectionPatterns) {
      cleaned = cleaned.replace(pattern, '[SECURITY_OVERRIDE_REDACTED]');
    }

    // Bound maximum input length
    if (cleaned.length > 2000) {
      cleaned = cleaned.substring(0, 2000) + '... [TRUNCATED]';
    }

    return cleaned.trim();
  }

  /**
   * Bounds and sanitizes logs before feeding into AI context.
   */
  boundLogs(logs: string): string {
    const sanitized = this.sanitizeText(logs);
    if (sanitized.length <= this.MAX_LOG_CHARS) {
      return sanitized;
    }
    // Take recent trailing portion of logs
    const slice = sanitized.slice(-this.MAX_LOG_CHARS);
    return `[...truncated earlier logs...]\n${slice}`;
  }

  /**
   * Bounds and sanitizes file / manifest content.
   */
  boundFileContent(content: string): string {
    const sanitized = this.sanitizeText(content);
    if (sanitized.length <= this.MAX_FILE_CHARS) {
      return sanitized;
    }
    return `${sanitized.substring(0, this.MAX_FILE_CHARS)}\n[...content truncated for size limits...]`;
  }
}
