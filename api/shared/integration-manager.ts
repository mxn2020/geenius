// netlify/functions/shared/integration-manager.ts
interface SlackConfig {
  webhookUrl: string;
  channel: string;
  username: string;
}

interface DiscordConfig {
  webhookUrl: string;
  username: string;
  avatarUrl?: string;
}

interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'ses';
  apiKey: string;
  fromEmail: string;
}

export class IntegrationManager {
  static async notifySlack(config: SlackConfig, message: string, sessionId?: string): Promise<void> {
    try {
      const payload = {
        channel: config.channel,
        username: config.username,
        text: message,
        attachments: sessionId ? [{
          color: 'good',
          fields: [{
            title: 'Session ID',
            value: sessionId,
            short: true
          }]
        }] : undefined
      };

      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Slack notification failed:', error);
    }
  }

  static async notifyDiscord(config: DiscordConfig, message: string, sessionId?: string): Promise<void> {
    try {
      const payload = {
        username: config.username,
        avatar_url: config.avatarUrl,
        content: message,
        embeds: sessionId ? [{
          title: 'AI Agent Session',
          fields: [{
            name: 'Session ID',
            value: sessionId,
            inline: true
          }],
          color: 0x00ff00,
          timestamp: new Date().toISOString()
        }] : undefined
      };

      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Discord notification failed:', error);
    }
  }

  static async sendEmail(config: EmailConfig, to: string, subject: string, body: string): Promise<void> {
    try {
      switch (config.provider) {
        case 'sendgrid':
          await this.sendViaSendGrid(config, to, subject, body);
          break;
        case 'mailgun':
          await this.sendViaMailgun(config, to, subject, body);
          break;
        case 'ses':
          await this.sendViaSES(config, to, subject, body);
          break;
      }
    } catch (error) {
      console.error('Email notification failed:', error);
    }
  }

  private static async sendViaSendGrid(config: EmailConfig, to: string, subject: string, body: string): Promise<void> {
    const payload = {
      personalizations: [{
        to: [{ email: to }]
      }],
      from: { email: config.fromEmail },
      subject,
      content: [{
        type: 'text/html',
        value: body
      }]
    };

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  private static async sendViaMailgun(config: EmailConfig, to: string, subject: string, body: string): Promise<void> {
    const domain = config.fromEmail.split('@')[1];
    const formData = new FormData();
    formData.append('from', config.fromEmail);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', body);

    await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`
      },
      body: formData
    });
  }

  private static async sendViaSES(config: EmailConfig, to: string, subject: string, body: string): Promise<void> {
    // AWS SES implementation would go here
    console.log('SES email sending not implemented in this demo');
  }

  static async triggerZapier(webhookUrl: string, data: any): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Zapier trigger failed:', error);
    }
  }

  static async notifyJira(config: any, issue: any): Promise<void> {
    try {
      // JIRA API integration for creating issues
      const payload = {
        fields: {
          project: { key: config.projectKey },
          summary: issue.summary,
          description: issue.description,
          issuetype: { name: 'Task' }
        }
      };

      await fetch(`${config.baseUrl}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('JIRA notification failed:', error);
    }
  }
}

