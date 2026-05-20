export class SheetService {
  private spreadsheetId: string;
  private token: string;

  constructor(spreadsheetId: string, token: string) {
    this.spreadsheetId = spreadsheetId;
    this.token = token;
  }

  private async action(name: string, body: any) {
    const res = await fetch(`/api/sheets/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ ...body, spreadsheetId: this.spreadsheetId }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error || errorText);
      } catch (e) {
        throw new Error(errorText);
      }
    }
    return res.json();
  }

  async read(range: string) {
    const data = await this.action('read', { range });
    return data.values || [];
  }

  async write(range: string, values: any[][]) {
    return this.action('write', { range, values });
  }

  async append(range: string, values: any[][]) {
    return this.action('append', { range, values });
  }

  // Pre-configured ranges for the 8 menus
  static RANGES = {
    CONTEXT: '1. Konteks!A1:Z50',
    IDENTIFICATION: '2. Identifikasi!A2:L500',
    ANALYSIS: '3. Analisis!A2:N500',
    EVALUATION: '4. Evaluasi!A2:L500',
    RTP: '5. RTP!A2:G500',
    COMMUNICATION: '6. Komunikasi!A2:H500',
    MONITORING: '7. Pemantauan!A2:G500',
    LOG: '8. Log!A2:K500',
  };
}
