import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private frontendUrl: string;
  private markPng: Buffer;
  private textPng: Buffer;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@withly.co.il';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.markPng = fs.readFileSync(path.join(__dirname, 'assets', 'WithlyLogo.png'));
    this.textPng = fs.readFileSync(path.join(__dirname, 'assets', 'WithlyHeader.png'));
  }

  /** Shared email wrapper: thick green bar → logo+Withly text → thin divider → content → thin divider → footer */
  private buildEmailHtml(bodyContent: string): string {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; background-color: #F4F4F5; font-family: 'Assistant', Arial, sans-serif; font-size: 16px; font-weight: 400; color: #000000; direction: rtl;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F4F5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" width="536" cellpadding="0" cellspacing="0" style="max-width: 536px; background-color: #FFFFFF; border: 1px solid #D0D0D4; border-radius: 12px; overflow: hidden;">
                <!-- 1. Thick green accent bar 536x25 -->
                <tr>
                  <td style="height: 25px; background-color: #A7EA7B; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 3. Spacing 23px -->
                <tr>
                  <td style="height: 23px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 4+5. Withly Logo + Header text as CID inline images -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" dir="ltr" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td valign="bottom" style="padding-right: 8px; padding-bottom: 3px;"><img src="cid:WithlyLogo" width="34" height="32" alt="Withly" style="display: block; border: 0;" /></td>
                        <td valign="bottom"><img src="cid:WithlyHeader" width="94" height="29" alt="Withly" style="display: block; border: 0;" /></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- 6. Spacing 32px -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 7. Thin green divider 440x1 centered -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <div style="width: 440px; max-width: 440px; height: 1px; background-color: #A7EA7B;"></div>
                  </td>
                </tr>
                <!-- 8. Spacing 32px -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- Main content -->
                ${bodyContent}
                <!-- 15. Spacing 32px -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 16. Thin green divider 440x1 centered -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <div style="width: 440px; max-width: 440px; height: 1px; background-color: #A7EA7B;"></div>
                  </td>
                </tr>
                <!-- 17. Spacing 32px -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 18. Footer -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.5; text-align: center; color: #000000; font-family: 'Assistant', Arial, sans-serif;">&#1499;&#1500; &#1492;&#1494;&#1499;&#1493;&#1497;&#1493;&#1514; &#1513;&#1502;&#1493;&#1512;&#1493;&#1514; <span dir="ltr" style="unicode-bidi: embed;">Withly</span> 2026</p>
                  </td>
                </tr>
                <!-- 19. Spacing 48px -->
                <tr>
                  <td style="height: 48px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private buildVerificationBody(name: string, verificationLink: string): string {
    return `
                <!-- 9. Email text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1513;&#1500;&#1493;&#1501; <span style="font-weight: 600;">${name}</span>,</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1514;&#1493;&#1491;&#1492; &#1513;&#1489;&#1495;&#1512;&#1514; &#1500;&#1492;&#1510;&#1496;&#1512;&#1507; &#1500;-<span dir="ltr" style="unicode-bidi: embed; font-weight: 600;">Withly</span>!</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1499;&#1491;&#1497; &#1500;&#1492;&#1513;&#1500;&#1497;&#1501; &#1488;&#1514; &#1514;&#1492;&#1500;&#1497;&#1498; &#1492;&#1492;&#1512;&#1513;&#1502;&#1492; &#1493;&#1500;&#1492;&#1508;&#1506;&#1497;&#1500; &#1488;&#1514; &#1492;&#1499;&#1514;&#1493;&#1489;&#1514; &#1497;&#1513; &#1500;&#1488;&#1502;&#1514; &#1488;&#1514; &#1499;&#1514;&#1493;&#1489;&#1514; &#1492;&#1502;&#1497;&#1497;&#1500; &#1489;&#1500;&#1495;&#1497;&#1510;&#1492; &#1506;&#1500; &#1492;&#1499;&#1508;&#1514;&#1493;&#1512;:</p>
                  </td>
                </tr>
                <!-- 11. Spacing 32px before button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 12. Button 167x50 -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${verificationLink}" style="display: inline-block; width: 167px; height: 50px; line-height: 50px; background-color: #000000; color: #FFFFFF !important; font-family: 'Assistant', Arial, sans-serif; font-size: 18px; font-weight: 400; text-decoration: none; border-radius: 12px; text-align: center;">&#1488;&#1497;&#1502;&#1493;&#1514; &#1499;&#1514;&#1493;&#1489;&#1514; &#1502;&#1497;&#1497;&#1500;</a>
                  </td>
                </tr>
                <!-- 13. Spacing 32px after button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 14. More text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1488;&#1501; &#1500;&#1488; &#1504;&#1512;&#1513;&#1502;&#1514; &#1500;&#1513;&#1497;&#1512;&#1493;&#1514;, &#1504;&#1497;&#1514;&#1503; &#1500;&#1492;&#1514;&#1506;&#1500;&#1501; &#1502;&#1492;&#1493;&#1491;&#1506;&#1492; &#1494;&#1493; &#1493;&#1492;&#1508;&#1512;&#1496;&#1497;&#1501; &#1513;&#1500;&#1498; &#1497;&#1497;&#1502;&#1495;&#1511;&#1493; &#1502;&#1492;&#1502;&#1506;&#1512;&#1499;&#1514;</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1492;&#1511;&#1497;&#1513;&#1493;&#1512; &#1497;&#1492;&#1497;&#1492; &#1514;&#1511;&#1507; &#1500;&#1502;&#1513;&#1498; 24 &#1513;&#1506;&#1493;&#1514; &#1489;&#1500;&#1489;&#1491;</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1489;&#1489;&#1512;&#1499;&#1492;,<br>&#1510;&#1493;&#1493;&#1514; <span dir="ltr" style="unicode-bidi: embed;">Withly</span></p>
                  </td>
                </tr>`;
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const verificationLink = `${this.frontendUrl}/verify-email?token=${token}`;
    const bodyContent = this.buildVerificationBody(name, verificationLink);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\nתודה שבחרת להצטרף ל-Withly!\nכדי להשלים את תהליך ההרשמה ולהפעיל את הכתובת יש לאמת את כתובת המייל בלחיצה על הקישור:\n${verificationLink}\n\nאם לא נרשמת לשירות, ניתן להתעלם מהודעה זו והפרטים שלך יימחקו מהמערכת\nהקישור יהיה תקף למשך 24 שעות בלבד\n\nבברכה,\nצוות Withly`;

    await this.sendEmail(email, 'ברוכים הבאים ל-Withly! אימות כתובת המייל שלך', htmlBody, textBody);
  }

  private buildWelcomeBody(name: string): string {
    return `
                <!-- 9. Email text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1513;&#1500;&#1493;&#1501; <span style="font-weight: 600;">${name}</span>,</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1489;&#1512;&#1493;&#1499;&#1497;&#1501; &#1492;&#1489;&#1488;&#1497;&#1501; &#1500;-<span dir="ltr" style="unicode-bidi: embed; font-weight: 600;">Withly</span>!</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1492;&#1495;&#1513;&#1489;&#1493;&#1503; &#1513;&#1500;&#1498; &#1504;&#1493;&#1510;&#1512; &#1489;&#1492;&#1510;&#1500;&#1495;&#1492; &#1493;&#1488;&#1514;&#1492; &#1502;&#1493;&#1494;&#1502;&#1503; &#1500;&#1492;&#1514;&#1495;&#1497;&#1500; &#1500;&#1490;&#1500;&#1493;&#1514; &#1511;&#1492;&#1497;&#1500;&#1493;&#1514;, &#1500;&#1492;&#1510;&#1496;&#1512;&#1507; &#1493;&#1500;&#1497;&#1510;&#1493;&#1512; &#1514;&#1493;&#1499;&#1503; &#1489;&#1500;&#1495;&#1497;&#1510;&#1514; &#1499;&#1508;&#1514;&#1493;&#1512;:</p>
                  </td>
                </tr>
                <!-- 11. Spacing 32px before button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 12. Button 167x50 -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${this.frontendUrl}" style="display: inline-block; width: 167px; height: 50px; line-height: 50px; background-color: #000000; color: #FFFFFF !important; font-family: 'Assistant', Arial, sans-serif; font-size: 18px; font-weight: 400; text-decoration: none; border-radius: 12px; text-align: center;">&#1499;&#1504;&#1497;&#1505;&#1492; &#1500;-<span dir="ltr" style="unicode-bidi: embed;">Withly</span></a>
                  </td>
                </tr>
                <!-- 13. Spacing 32px after button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 14. More text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1489;&#1489;&#1512;&#1499;&#1492;,<br>&#1510;&#1493;&#1493;&#1514; <span dir="ltr" style="unicode-bidi: embed;">Withly</span></p>
                  </td>
                </tr>`;
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const bodyContent = this.buildWelcomeBody(name);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\nברוכים הבאים ל-Withly!\nהחשבון שלך נוצר בהצלחה ואתה מוזמן להתחיל לגלות קהילות, להצטרף וליצור תוכן בלחיצת כפתור:\n\nבברכה,\nצוות Withly`;

    await this.sendEmail(email, 'ברוכים הבאים ל-Withly!', htmlBody, textBody);
  }

  private buildPasswordResetBody(name: string, resetLink: string): string {
    return `
                <!-- 9. Email text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1513;&#1500;&#1493;&#1501; <span style="font-weight: 600;">${name}</span>,</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1511;&#1497;&#1489;&#1500;&#1504;&#1493; &#1489;&#1511;&#1513;&#1492; &#1500;&#1488;&#1497;&#1508;&#1493;&#1505; &#1492;&#1505;&#1497;&#1505;&#1502;&#1492; &#1500;&#1495;&#1513;&#1489;&#1493;&#1504;&#1498;. &#1499;&#1491;&#1497; &#1500;&#1492;&#1490;&#1491;&#1497;&#1512; &#1505;&#1497;&#1505;&#1502;&#1492; &#1495;&#1491;&#1513;&#1492;, &#1497;&#1513; &#1500;&#1500;&#1495;&#1493;&#1509; &#1506;&#1500; &#1492;&#1499;&#1508;&#1514;&#1493;&#1512; &#1500;&#1502;&#1496;&#1492;:</p>
                  </td>
                </tr>
                <!-- 11. Spacing 32px before button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 12. Button 167x50 -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${resetLink}" style="display: inline-block; width: 167px; height: 50px; line-height: 50px; background-color: #000000; color: #FFFFFF !important; font-family: 'Assistant', Arial, sans-serif; font-size: 18px; font-weight: 400; text-decoration: none; border-radius: 12px; text-align: center;">&#1488;&#1497;&#1508;&#1493;&#1505; &#1505;&#1497;&#1505;&#1502;&#1492;</a>
                  </td>
                </tr>
                <!-- 13. Spacing 32px after button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 14. More text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1488;&#1501; &#1500;&#1488; &#1489;&#1497;&#1511;&#1513;&#1514; &#1500;&#1489;&#1510;&#1506; &#1508;&#1506;&#1493;&#1500;&#1492; &#1494;&#1493;, &#1504;&#1497;&#1514;&#1503; &#1500;&#1492;&#1514;&#1506;&#1500;&#1501; &#1502;&#1492;&#1493;&#1491;&#1506;&#1492; &#1494;&#1493; &#1493;&#1492;&#1505;&#1497;&#1505;&#1502;&#1492; &#1513;&#1500;&#1498; &#1514;&#1497;&#1513;&#1488;&#1512; &#1500;&#1500;&#1488; &#1513;&#1497;&#1504;&#1493;&#1497;.</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;"><span style="font-weight: 600;">&#1513;&#1497;&#1501; &#1500;&#1489;:</span> &#1492;&#1511;&#1497;&#1513;&#1493;&#1512; &#1497;&#1492;&#1497;&#1492; &#1514;&#1511;&#1507; &#1500;&#1502;&#1513;&#1498; &#1513;&#1506;&#1492; &#1489;&#1500;&#1489;&#1491;.</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1489;&#1489;&#1512;&#1499;&#1492;,<br>&#1510;&#1493;&#1493;&#1514; <span dir="ltr" style="unicode-bidi: embed;">Withly</span></p>
                  </td>
                </tr>`;
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${token}`;
    const bodyContent = this.buildPasswordResetBody(name, resetLink);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\nקיבלנו בקשה לאיפוס הסיסמה לחשבונך. כדי להגדיר סיסמה חדשה, לחץ על הקישור:\n${resetLink}\n\nאם לא ביקשת לבצע פעולה זו, ניתן להתעלם מהודעה זו והסיסמה שלך תישאר ללא שינוי\nשים לב: הקישור יהיה תקף למשך שעה בלבד\n\nבברכה,\nצוות Withly`;

    await this.sendEmail(email, 'איפוס סיסמה לחשבון Withly שלך', htmlBody, textBody);
  }

  async sendContactEmail(name: string, email: string, subject: string, message: string): Promise<void> {
    const supportEmails = ['tomer@withly.co.il', 'sean@withly.co.il'];

    const bodyContent = `
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600; line-height: 1.5; text-align: center; direction: rtl; font-family: 'Assistant', Arial, sans-serif; color: #000000;">פנייה חדשה מטופס יצירת קשר</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; font-family: 'Assistant', Arial, sans-serif; color: #000000;"><span style="font-weight: 600;">שם:</span> ${name}</p>
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; font-family: 'Assistant', Arial, sans-serif; color: #000000;"><span style="font-weight: 600;">אימייל:</span> <a href="mailto:${email}" style="color: #000000; text-decoration: underline;">${email}</a></p>
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; font-family: 'Assistant', Arial, sans-serif; color: #000000;"><span style="font-weight: 600;">נושא:</span> ${subject}</p>
                    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; line-height: 1.7; text-align: right; direction: rtl; font-family: 'Assistant', Arial, sans-serif; color: #000000;">הודעה:</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #F4F4F5; border-radius: 8px; padding: 16px;">
                          <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; font-family: 'Assistant', Arial, sans-serif; color: #000000;">${message.replace(/\n/g, '<br>')}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;

    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `פנייה חדשה מטופס יצירת קשר\n\nשם: ${name}\nאימייל: ${email}\nנושא: ${subject}\n\nהודעה:\n${message}`;

    await this.sendEmail(supportEmails, `צור קשר: ${subject}`, htmlBody, textBody);
  }

  private get inlineAttachments() {
    return [
      { filename: 'WithlyLogo.png', content: this.markPng, contentId: 'WithlyLogo' },
      { filename: 'WithlyHeader.png', content: this.textPng, contentId: 'WithlyHeader' },
    ];
  }

  private async sendEmail(to: string | string[], subject: string, htmlBody: string, textBody: string): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: htmlBody,
        text: textBody,
        attachments: this.inlineAttachments,
      });

      if (error) {
        console.error('Failed to send email:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}
