/**
 * TenK email and text sends: input checks shared by the SPA and the endpoint.
 * Keep identical to scripts/notifications.ts on the Traction Maestro endpoint.
 *
 * Sending = saving an entry. An email is a new System Notification History entry (Type E-mail);
 * a text is a new Twilio Log entry. A post-save formula on each form does the actual send.
 * Texts always go through Twilio, never through System Notification History's Text type.
 */

export const LIMITS = {to: 254, toName: 120, subject: 200, emailBody: 10000, textBody: 600}

/** UserAssignedID prefix on System Notification History entries created by TenK. */
export const EMAIL_TAG_PREFIX = 'tenk:'
/** Text Message prefix on Twilio Log entries sent from the testing page. */
export const TEST_TEXT_PREFIX = '[TenK test] '

export interface EmailSend { to: string; toName: string; subject: string; html: string }
export interface TextSend { to: string; recipientName: string; message: string }
export type Checked<T> = {ok: true; value: T} | {ok: false; error: string}

const EMAIL = /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[A-Za-z]{2,}$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isEmail(value: string): boolean {
  return value.length <= LIMITS.to && EMAIL.test(value)
}

/**
 * A US phone number as 10 digits, from +1XXXXXXXXXX, 1XXXXXXXXXX, (XXX) XXX-XXXX, XXX-XXX-XXXX,
 * XXX.XXX.XXXX or 10 bare digits. Anything else (letters, extensions, other countries) is null.
 */
export function normalizeUsPhone(value: unknown): string | null {
  const raw = text(value)
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1)
  if (digits.length !== 10) return null
  // NANP: area code and exchange cannot start with 0 or 1.
  if (digits.charAt(0) < '2' || digits.charAt(3) < '2') return null
  return digits
}

/** (XXX) XXX-XXXX for display. */
export function formatUsPhone(digits: string): string {
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6)
}

export function validateEmailSend(input: {to?: unknown; toName?: unknown; subject?: unknown; html?: unknown}): Checked<EmailSend> {
  const to = text(input.to)
  const toName = text(input.toName)
  const subject = text(input.subject)
  const html = text(input.html)
  if (!to) return {ok: false, error: 'Enter an email address to send to.'}
  if (!isEmail(to)) return {ok: false, error: 'That is not a valid email address.'}
  if (toName.length > LIMITS.toName) return {ok: false, error: 'The recipient name is too long (' + LIMITS.toName + ' characters at most).'}
  if (!subject) return {ok: false, error: 'Enter a subject.'}
  if (subject.length > LIMITS.subject) return {ok: false, error: 'The subject is too long (' + LIMITS.subject + ' characters at most).'}
  if (!html) return {ok: false, error: 'Enter a message.'}
  if (html.length > LIMITS.emailBody) return {ok: false, error: 'The message is too long (' + LIMITS.emailBody + ' characters at most).'}
  return {ok: true, value: {to, toName, subject, html}}
}

export function validateTextSend(input: {to?: unknown; recipientName?: unknown; message?: unknown}): Checked<TextSend> {
  const rawTo = text(input.to)
  const recipientName = text(input.recipientName)
  const message = text(input.message)
  if (!rawTo) return {ok: false, error: 'Enter a phone number to send to.'}
  const to = normalizeUsPhone(rawTo)
  if (!to) return {ok: false, error: 'That is not a valid US phone number (10 digits).'}
  if (recipientName.length > LIMITS.toName) return {ok: false, error: 'The recipient name is too long (' + LIMITS.toName + ' characters at most).'}
  if (!message) return {ok: false, error: 'Enter a message.'}
  if (message.length > LIMITS.textBody) return {ok: false, error: 'The message is too long (' + LIMITS.textBody + ' characters at most).'}
  return {ok: true, value: {to, recipientName, message}}
}

/** Plain text typed in the testing page as safe HTML for an email body (escaped, line breaks kept). */
export function plainTextToHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\r\n|\r|\n/g, '<br>')
}

/** UserAssignedID for a TenK email entry: tenk:<kind>:<unique>. kind is a short slug like "test". */
export function emailTag(kind: string, unique: string): string {
  const slug = kind.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'misc'
  return EMAIL_TAG_PREFIX + slug + ':' + unique
}

export function isTestEmailTag(tag: unknown): boolean {
  return typeof tag === 'string' && tag.indexOf(EMAIL_TAG_PREFIX + 'test:') === 0
}

export function testTextMessage(message: string): string {
  return message.indexOf(TEST_TEXT_PREFIX) === 0 ? message : TEST_TEXT_PREFIX + message
}

export function isTestText(message: unknown): boolean {
  return typeof message === 'string' && message.indexOf(TEST_TEXT_PREFIX) === 0
}

export type SendStatus = 'sent' | 'failed' | 'pending'

/** Email status from a System Notification History entry. Status text wins when it names a failure. */
export function emailStatus(processed: boolean | null, status: string): {status: SendStatus; detail: string} {
  const s = (status || '').trim()
  if (/fail|error|invalid|bounce/i.test(s)) return {status: 'failed', detail: s}
  if (processed === true) return {status: 'sent', detail: s || 'Processed by the notification sender.'}
  return {status: 'pending', detail: s || 'Saved. Waiting for the notification sender to process it.'}
}

/** Text status from a Twilio Log entry. */
export function textStatus(complete: boolean | null, error: string): {status: SendStatus; detail: string} {
  const e = (error || '').trim()
  if (e) return {status: 'failed', detail: e}
  if (complete === true) return {status: 'sent', detail: 'Accepted by Twilio. Delivery to the phone is not confirmed.'}
  return {status: 'pending', detail: 'Saved. Waiting for the Twilio sender to report back.'}
}
