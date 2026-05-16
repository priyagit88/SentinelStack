/**
 * SentinelStack Mail Client Utility
 * Handles polling for OTPs and Magic Links from Mailtrap or similar services.
 */

export class MailClient {
  private apiKey: string;
  private inboxId: string;
  private baseUrl = 'https://mailtrap.io/api/accounts';

  constructor() {
    this.apiKey = process.env.MAILTRAP_API_KEY || '';
    this.inboxId = process.env.MAILTRAP_INBOX_ID || '';
  }

  /**
   * Generates a unique email address for parallel test safety.
   */
  static generateTestEmail(workerIndex: number): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test-${workerIndex}-${timestamp}-${random}@sentinelstack.test`;
  }

  /**
   * Polls for the latest email sent to a specific address.
   */
  async getLatestEmail(to: string, timeout = 30000): Promise<any> {
    if (!this.apiKey || !this.inboxId) {
      console.warn('Mailtrap API key or Inbox ID missing. Falling back to mock email (TEST ONLY).');
      return this.getMockEmail(to);
    }

    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(
          `https://mailtrap.io/api/inboxes/${this.inboxId}/messages?search=${encodeURIComponent(to)}`,
          {
            headers: {
              'Api-Token': this.apiKey,
              'Accept': 'application/json',
            },
          }
        );

        if (response.ok) {
          const messages = await response.json();
          if (messages && messages.length > 0) {
            const msgId = messages[0].id;
            const bodyRes = await fetch(
              `https://mailtrap.io/api/inboxes/${this.inboxId}/messages/${msgId}/body.html`,
              {
                headers: { 'Api-Token': this.apiKey },
              }
            );
            const body = await bodyRes.text();
            return { subject: messages[0].subject, body };
          }
        }
      } catch (error) {
        console.error('Error polling Mailtrap:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Timeout waiting for email to ${to}`);
  }

  extractOtp(body: string): string {
    const match = body.match(/\b\d{6}\b/);
    return match ? match[0] : '';
  }

  extractLink(body: string): string {
    const match = body.match(/href="([^"]*verify[^"]*)"/);
    return match ? match[1] : '';
  }

  private async getMockEmail(to: string): Promise<any> {
    console.log(`MOCK: Polling for email to ${to}...`);
    await new Promise(r => setTimeout(r, 1000));
    return {
      subject: 'Your SentinelStack Security Passcode',
      body: '<div>Your code is 123456</div>'
    };
  }
}
