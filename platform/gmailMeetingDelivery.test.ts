import {it,expect} from 'vitest'
import {gmailDeliveryResult} from './gmailMeetingDelivery'
it('reports Gmail acceptance without claiming delivery',()=>{expect(gmailDeliveryResult(true,'').status).toBe('sent');expect(gmailDeliveryResult(true,'').detail).toContain('not confirmed')})
it('shows a useful reconnect message without disclosing provider errors',()=>{const result=gmailDeliveryResult(false,'AUTH FAILED: invalid_grant sensitive-provider-data');expect(result.status).toBe('failed');expect(result.detail).toContain('Google Settings');expect(result.detail).not.toContain('sensitive-provider-data')})
it('preserves pending and does not mistake missing response for failure or success',()=>{expect(gmailDeliveryResult(null,'').status).toBe('submitted');expect(gmailDeliveryResult(false,'').status).toBe('submitted');expect(gmailDeliveryResult(false,'Other provider failure').status).toBe('failed')})
