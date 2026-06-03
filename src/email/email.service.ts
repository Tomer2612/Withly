import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { readFile } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private frontendUrl: string;
  private inlineAttachmentsPromise: Promise<{ filename: string; content: Buffer; contentId: string }[]> | null = null;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@withly.co.il';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
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
    const supportEmails = ['support@withly.co.il'];

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

  private buildEventReminderBody(userName: string, eventTitle: string, eventDate: string, eventTime: string, communityName: string, eventLink: string): string {
    return `
                <!-- 9. Email text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1513;&#1500;&#1493;&#1501; <span style="font-weight: 600;">${userName}</span>,</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#1512;&#1510;&#1497;&#1504;&#1493; &#1500;&#1492;&#1494;&#1499;&#1497;&#1512; &#1500;&#1498; &#1513;&#1492;&#1488;&#1497;&#1512;&#1493;&#1506; <span style="font-weight: 600;">${eventTitle}</span> &#1489;&#1511;&#1492;&#1497;&#1500;&#1514; <span style="font-weight: 600;">${communityName}</span> &#1502;&#1514;&#1511;&#1512;&#1489;!</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">&#x1F4C5; <span style="font-weight: 600;">${eventDate}</span> &#1489;&#1513;&#1506;&#1492; <span style="font-weight: 600;">${eventTime}</span></p>
                  </td>
                </tr>
                <!-- 11. Spacing 32px before button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- 12. Button -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${eventLink}" style="display: inline-block; width: 200px; height: 50px; line-height: 50px; background-color: #000000; color: #FFFFFF !important; font-family: 'Assistant', Arial, sans-serif; font-size: 18px; font-weight: 400; text-decoration: none; border-radius: 12px; text-align: center;">&#1510;&#1508;&#1497;&#1497;&#1492; &#1489;&#1488;&#1497;&#1512;&#1493;&#1506;</a>
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

  // Shared body shape for informational payment-confirmation emails — no
  // CTA button, just greeting + two short paragraphs + signoff. Matches
  // the existing template's padding/typography.
  private buildPaymentInfoBody(name: string, lines: string[]): string {
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = lines
      .map(
        (line) =>
          `<p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">${escape(line)}</p>`,
      )
      .join('\n                    ');
    return `
                <!-- 9. Email text -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">שלום <span style="font-weight: 600;">${escape(name)}</span>,</p>
                    ${paragraphs}
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">בברכה,<br>צוות <span dir="ltr" style="unicode-bidi: embed;">Withly</span></p>
                  </td>
                </tr>`;
  }

  // Phase 3.6 — sent after the user adds a NEW card to their personal
  // wallet via Settings (Phase 3.1). For security: any time a new payment
  // method lands on the account, the user gets notified by email so an
  // attacker can't quietly attach a card without their knowledge. Not sent
  // on token-refresh (same card re-added) to avoid spam.
  async sendPaymentMethodAddedEmail(
    email: string,
    name: string,
    cardBrand: string,
    cardLastFour: string,
  ): Promise<void> {
    const cardLine = `${cardBrand} ************${cardLastFour}`;
    const bodyContent = this.buildPaymentInfoBody(name, [
      `כרטיס אשראי חדש נוסף לחשבון שלך ב-Withly:`,
      cardLine,
      `אם לא ביצעת את הפעולה הזו בעצמך, אנא צור איתנו קשר מיד.`,
    ]);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\nכרטיס אשראי חדש נוסף לחשבון שלך ב-Withly:\n${cardLine}\n\nאם לא ביצעת את הפעולה הזו בעצמך, אנא צור איתנו קשר מיד.\n\nבברכה,\nצוות Withly`;

    await this.sendEmail(email, 'כרטיס אשראי נוסף לחשבון Withly שלך', htmlBody, textBody);
  }

  // Phase 3.6 — sent after the billing card for a specific community is
  // changed (Phase 3.2/3.3). Only on actual card change — not on
  // wasAlreadyBound re-binds — to avoid noise on suspended-community
  // renewal flows where the user re-enters the same card.
  async sendCommunityCardUpdatedEmail(
    email: string,
    name: string,
    communityName: string,
    cardBrand: string,
    cardLastFour: string,
  ): Promise<void> {
    const cardLine = `${cardBrand} ************${cardLastFour}`;
    const bodyContent = this.buildPaymentInfoBody(name, [
      `אמצעי התשלום של הקהילה "${communityName}" עודכן בהצלחה:`,
      cardLine,
      `חיובים עתידיים של המנוי יבוצעו לכרטיס זה.`,
      `אם לא ביצעת את הפעולה הזו בעצמך, אנא צור איתנו קשר מיד.`,
    ]);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\nאמצעי התשלום של הקהילה "${communityName}" עודכן בהצלחה:\n${cardLine}\n\nחיובים עתידיים של המנוי יבוצעו לכרטיס זה.\n\nאם לא ביצעת את הפעולה הזו בעצמך, אנא צור איתנו קשר מיד.\n\nבברכה,\nצוות Withly`;

    await this.sendEmail(email, `אמצעי התשלום של ${communityName} עודכן`, htmlBody, textBody);
  }

  async sendEventReminder(
    email: string,
    userName: string,
    eventTitle: string,
    eventDate: string,
    eventTime: string,
    communityName: string,
    eventLink: string,
  ): Promise<void> {
    const bodyContent = this.buildEventReminderBody(userName, eventTitle, eventDate, eventTime, communityName, eventLink);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${userName},\n\nרצינו להזכיר לך שהאירוע "${eventTitle}" בקהילת ${communityName} מתקרב!\n\n📅 ${eventDate} בשעה ${eventTime}\n\nצפייה באירוע: ${eventLink}\n\nבברכה,\nצוות Withly`;

    await this.sendEmail(email, `תזכורת: ${eventTitle} מתקרב!`, htmlBody, textBody);
  }

  // Lazy-load + cache the inline image attachments. Reading on first send
  // (instead of in the constructor) keeps boot off the filesystem and means
  // a missing asset degrades gracefully (email goes out without the logo)
  // rather than crashing module init.
  private getInlineAttachments() {
    if (!this.inlineAttachmentsPromise) {
      this.inlineAttachmentsPromise = (async () => {
        try {
          const [markPng, textPng] = await Promise.all([
            readFile(path.join(__dirname, 'assets', 'WithlyLogo.png')),
            readFile(path.join(__dirname, 'assets', 'WithlyHeader.png')),
          ]);
          return [
            { filename: 'WithlyLogo.png', content: markPng, contentId: 'WithlyLogo' },
            { filename: 'WithlyHeader.png', content: textPng, contentId: 'WithlyHeader' },
          ];
        } catch {
          return [];
        }
      })();
    }
    return this.inlineAttachmentsPromise;
  }

  private async sendEmail(to: string | string[], subject: string, htmlBody: string, textBody: string): Promise<void> {
    const attachments = await this.getInlineAttachments();
    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: htmlBody,
      text: textBody,
      attachments,
    });

    if (error) {
      throw error;
    }
  }

  // Generalized body builder for lifecycle emails (price changes, owner
  // welcomes, cancellations, reminders). Same greeting + paragraphs +
  // optional CTA + signoff layout the existing emails use, just with
  // the CTA made optional and the paragraph list driven by the caller.
  // All text passes through the same XSS escape as buildPaymentInfoBody.
  private buildLifecycleBody(
    name: string | null,
    lines: string[],
    cta?: { label: string; url: string },
  ): string {
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = lines
      .map(
        (line) =>
          `<p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">${escape(line)}</p>`,
      )
      .join('\n                    ');

    // Greeting line: "שלום {name}," with the name bolded. When name is
    // null (e.g., final account-deleted email), drop the name entirely.
    const greeting = name
      ? `<p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">שלום <span style="font-weight: 600;">${escape(name)}</span>,</p>`
      : `<p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">שלום,</p>`;

    const ctaBlock = cta
      ? `
                <!-- Spacing 32px before button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>
                <!-- Button -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${cta.url}" style="display: inline-block; min-width: 167px; height: 50px; line-height: 50px; padding: 0 24px; background-color: #000000; color: #FFFFFF !important; font-family: 'Assistant', Arial, sans-serif; font-size: 18px; font-weight: 400; text-decoration: none; border-radius: 12px; text-align: center;">${escape(cta.label)}</a>
                  </td>
                </tr>
                <!-- Spacing 32px after button -->
                <tr>
                  <td style="height: 32px; line-height: 0; font-size: 0;">&nbsp;</td>
                </tr>`
      : '';

    return `
                <!-- Email text -->
                <tr>
                  <td style="padding: 0 48px;">
                    ${greeting}
                    ${paragraphs}
                  </td>
                </tr>
                ${ctaBlock}
                <!-- Signoff -->
                <tr>
                  <td style="padding: 0 48px;">
                    <p style="margin: 0; font-size: 16px; font-weight: 400; line-height: 1.7; text-align: right; direction: rtl; unicode-bidi: embed; font-family: 'Assistant', Arial, sans-serif; color: #000000;">בברכה,<br>צוות <span dir="ltr" style="unicode-bidi: embed;">Withly</span></p>
                  </td>
                </tr>`;
  }

  // #1 — Owner announced a price change. Sent to every member of the
  // community. Mirrors the existing in-app popup (which fires on next
  // community visit) and the new PRICE_CHANGE_ANNOUNCED notification
  // (bell icon, fires immediately). Members who don't open the
  // community AND don't check the bell still get this email.
  async sendPriceChangeAnnouncementEmail(
    email: string,
    name: string,
    communityName: string,
    oldPrice: number,
    newPrice: number,
    effectiveDate: string,
  ): Promise<void> {
    const subject = `שינוי מחיר בקהילה "${communityName}"`;
    const lines = [
      `החל מ-${effectiveDate}, המחיר החודשי של הקהילה "${communityName}" ישתנה מ-${oldPrice}₪ ל-${newPrice}₪ בחודש.`,
      `המנוי הנוכחי ימשיך לפעול במחיר הנוכחי (${oldPrice}₪) עד למועד המעבר. אין צורך בפעולה כדי להמשיך כרגיל.`,
      `לביטול המנוי לפני המעבר, ניתן לעשות זאת דרך הגדרות החשבון.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'ניהול מנויים',
      url: `${this.frontendUrl}/settings#payment`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nניהול מנויים: ${this.frontendUrl}/settings#payment\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #2 — 7-day reminder before a previously-announced price change
  // takes effect. Fires from the daily cron via priceChangeReminderSentAt.
  async sendPriceChangeReminderEmail(
    email: string,
    name: string,
    communityName: string,
    newPrice: number,
    effectiveDate: string,
  ): Promise<void> {
    const subject = `תזכורת — מחיר הקהילה "${communityName}" משתנה בעוד 7 ימים`;
    const lines = [
      `זוהי תזכורת — בעוד 7 ימים, ב-${effectiveDate}, המחיר החודשי של הקהילה "${communityName}" ישתנה ל-${newPrice}₪ בחודש.`,
      `החיוב הבא יתבצע במחיר החדש. להמשך כרגיל, אין צורך בפעולה.`,
      `לביטול המנוי לפני המעבר, ניתן לעשות זאת דרך הגדרות החשבון.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'ניהול מנויים',
      url: `${this.frontendUrl}/settings#payment`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nניהול מנויים: ${this.frontendUrl}/settings#payment\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #4 — Owner just created their community via the pricing flow. Sent
  // immediately after finalizeCommunityFromPending succeeds. No invoice
  // line (community is in free trial; no charge has happened yet —
  // EasyCount only sends a tax receipt after a real SOFT charge).
  async sendOwnerCommunityWelcomeEmail(
    email: string,
    name: string,
    communityId: string,
    trialEndDate: string,
  ): Promise<void> {
    const subject = `ברוכים הבאים ל-Withly — הקהילה שלך מוכנה!`;
    const lines = [
      `ברוכים הבאים ל-Withly! הקהילה שלך נפתחה בהצלחה ומוכנה להתחיל.`,
      `תקופת הניסיון מסתיימת ב-${trialEndDate}, ולאחר מכן יתחיל החיוב החודשי.`,
      `מומלץ להשלים את הגדרות הקהילה לפני שמזמינים את החברים.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'מעבר לקהילה שלי',
      url: `${this.frontendUrl}/communities/${communityId}/manage`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nמעבר לקהילה: ${this.frontendUrl}/communities/${communityId}/manage\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #8 — Owner cancelled their Withly subscription for a community.
  // Confirmation only; no CTA. Members get the existing popup +
  // COMMUNITY_SCHEDULED_FOR_SUSPENSION notification separately.
  async sendOwnerCancellationConfirmationEmail(
    email: string,
    name: string,
    communityName: string,
    effectiveDate: string,
  ): Promise<void> {
    const subject = `אישור ביטול המנוי שלך ב-Withly`;
    const lines = [
      `ביטול המנוי שלך ב-Withly עבור הקהילה "${communityName}" התקבל בהצלחה.`,
      `הקהילה תישאר פעילה עד ${effectiveDate}. החל מאותו תאריך, הקהילה תושעה והחברים לא יוכלו להיכנס. החיוב החודשי של חברים משלמים ייעצר אוטומטית.`,
      `לכל שאלה או תקלה, אנחנו כאן.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #9 — 7-day reminder before an owner's cancelled subscription takes
  // effect (community gets suspended). Last chance to renew. Fires from
  // the daily cron via suspensionReminderSentAt.
  async sendSuspensionReminderEmail(
    email: string,
    name: string,
    communityName: string,
    communityId: string,
    suspensionDate: string,
  ): Promise<void> {
    const subject = `תזכורת — הקהילה "${communityName}" תושעה בעוד 7 ימים`;
    const lines = [
      `זוהי תזכורת — בעוד 7 ימים, ב-${suspensionDate}, הקהילה שלך "${communityName}" תושעה בעקבות ביטול המנוי.`,
      `לשינוי ההחלטה, ניתן לחדש את המנוי בכל עת והקהילה תמשיך לפעול ללא הפסקה.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'חידוש מנוי',
      url: `${this.frontendUrl}/communities/${communityId}/manage`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nחידוש מנוי: ${this.frontendUrl}/communities/${communityId}/manage\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #3 — Member just joined a paid community and the first month's SOFT
  // charge succeeded. EasyCount sends the tax receipt automatically;
  // this email is the Withly-branded confirmation + entry CTA so the
  // member knows they're in and when the next charge fires.
  async sendPaidMemberJoinedEmail(
    email: string,
    name: string,
    communityName: string,
    communityId: string,
    amountILS: number,
    nextBillingDate: string,
  ): Promise<void> {
    const subject = `אישור הצטרפות לקהילה "${communityName}"`;
    const lines = [
      `תודה על ההצטרפות לקהילה "${communityName}".`,
      `החיוב הראשון בסכום של ₪${amountILS} בוצע בהצלחה.`,
      `תאריך החיוב הבא: ${nextBillingDate}.`,
      `החשבונית מצורפת לאימייל זה.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'כניסה לקהילה',
      url: `${this.frontendUrl}/communities/${communityId}/feed`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nכניסה לקהילה: ${this.frontendUrl}/communities/${communityId}/feed\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #6 — Phase 4 monthly SOFT charge failed. Community has already been
  // suspended by the cron at the moment this email fires; owner needs
  // to update the payment method to reactivate. No auto-retry in the
  // current design (suspend-on-first-failure), so the copy avoids
  // promising a next attempt date.
  async sendPaymentFailedEmail(
    email: string,
    name: string,
    communityName: string,
    communityId: string,
    monthlyPriceILS: number,
  ): Promise<void> {
    const subject = `התשלום החודשי לא עבר — הקהילה "${communityName}" הושעתה`;
    const lines = [
      `ניסינו לחייב את אמצעי התשלום עבור הקהילה "${communityName}" בסכום של ₪${monthlyPriceILS}, אך החיוב לא עבר.`,
      `הקהילה הושעתה, והחברים לא יוכלו להיכנס עד שהמנוי יחודש.`,
      `לחידוש הגישה, יש לעדכן את אמצעי התשלום.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'עדכון אמצעי תשלום',
      url: `${this.frontendUrl}/communities/${communityId}/manage`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nעדכון אמצעי תשלום: ${this.frontendUrl}/communities/${communityId}/manage\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // Phase 4 Mission 4.1a — 3-day pre-trial-end reminder. Sent to the
  // owner BEFORE the first monthly SOFT charge fires, so the charge
  // doesn't arrive silently. The pricing-page checkout copy already
  // promises this reminder; this method delivers on that promise.
  // Hebrew UX guide: noun-form CTA, passive constructions throughout,
  // no 2nd-person verbs or "אם תרצו" patterns.
  async sendTrialEndingReminderEmail(
    email: string,
    name: string,
    communityName: string,
    monthlyPrice: number,
    chargeDate: string,
  ): Promise<void> {
    const subject = `תזכורת — תקופת הניסיון של "${communityName}" מסתיימת בעוד 3 ימים`;
    const lines = [
      `תקופת הניסיון של הקהילה "${communityName}" מסתיימת ב-${chargeDate}.`,
      `החל מאותו תאריך יחויב אמצעי התשלום בסך ₪${monthlyPrice} בחודש.`,
      `להמשך כרגיל, אין צורך בפעולה.`,
      `לביטול המנוי לפני המעבר, ניתן לעשות זאת דרך הגדרות החשבון.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'ניהול מנויים',
      url: `${this.frontendUrl}/settings#payment`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nניהול מנויים: ${this.frontendUrl}/settings#payment\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #6 (member variant) — Phase 4 Mission 4: member-side recurring
  // SOFT charge failed. The member's MemberSubscription is now PAST_DUE
  // but the community itself is still active (unlike the owner-side
  // failure which suspends the whole community). Different recipient
  // context = different copy: speaks to the member about THEIR sub,
  // not the community's overall status. CTA points to their wallet.
  async sendMemberPaymentFailedEmail(
    email: string,
    name: string,
    communityName: string,
    amountILS: number,
  ): Promise<void> {
    const subject = `התשלום החודשי לקהילה "${communityName}" לא עבר`;
    const lines = [
      `ניסינו לחייב את אמצעי התשלום עבור המנוי לקהילה "${communityName}" בסכום של ₪${amountILS}, אך החיוב לא עבר.`,
      `המנוי הושהה. הגישה לקהילה תיחסם בקרוב.`,
      `לחידוש המנוי, יש לעדכן את אמצעי התשלום בהגדרות החשבון.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines, {
      label: 'עדכון אמצעי תשלום',
      url: `${this.frontendUrl}/settings#payment`,
    });
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nעדכון אמצעי תשלום: ${this.frontendUrl}/settings#payment\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #7 — Member-cancellation confirmation. Sent after a member taps
  // "cancel paid membership". No CTA: this is informational. Period
  // continues to endDate then auto-cancels via the cron pass. Industry
  // standard: no prorated refund, member retains the period they paid
  // for.
  async sendMemberCancellationConfirmationEmail(
    email: string,
    name: string,
    communityName: string,
    endDate: string,
  ): Promise<void> {
    const subject = `ביטול המנוי לקהילה "${communityName}" התקבל`;
    const lines = [
      `ביטול המנוי לקהילה "${communityName}" התקבל בהצלחה.`,
      `הגישה לקהילה תישמר עד ${endDate}, ולאחר מכן תיפסק אוטומטית. החיוב הבא לא יתבצע.`,
      `ניתן להצטרף מחדש בכל עת.`,
    ];
    const bodyContent = this.buildLifecycleBody(name, lines);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  // #12 — Account-deletion confirmation. Sent BEFORE the user row is
  // deleted (caller must capture email + name first, then delete).
  // No CTA — there's nothing to come back to.
  async sendAccountDeletedEmail(email: string, name: string): Promise<void> {
    const subject = `החשבון שלך ב-Withly נמחק`;
    const lines = [
      `החשבון שלך ב-Withly נמחק לצמיתות בהתאם לבקשתך.`,
      `כל המנויים הפעילים בוטלו והחיובים החודשיים נעצרו.`,
      `לכל שאלה או תקלה, אנחנו כאן.`,
    ];
    // Passing null for name so the greeting reads "שלום," (no name) —
    // matches the user's spec mockup which has just "שלום," for this
    // email (the deletion is final and impersonal at this point).
    const bodyContent = this.buildLifecycleBody(null, lines);
    const htmlBody = this.buildEmailHtml(bodyContent);
    const textBody = `שלום ${name},\n\n${lines.join('\n\n')}\n\nבברכה,\nצוות Withly`;
    await this.sendEmail(email, subject, htmlBody, textBody);
  }
}
