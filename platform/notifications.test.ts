import {describe,expect,it} from 'vitest'
import {LIMITS,emailStatus,emailTag,formatUsPhone,isTestEmailTag,isTestText,normalizeUsPhone,plainTextToHtml,testTextMessage,textStatus,validateEmailSend,validateTextSend} from './notifications'

describe('normalizeUsPhone',()=>{
 it('accepts common US formats',()=>{
  for(const v of ['+1 555 201 0142','15552010142','(555) 201-0142','555-201-0142','555.201.0142','5552010142'])expect(normalizeUsPhone(v)).toBe('5552010142')
 })
 it('refuses everything else',()=>{
  for(const v of ['','201-0142','555-201-01422','abc5552010142','+44 20 7946 0958','055-201-0142','555-101-0142',null,42])expect(normalizeUsPhone(v)).toBeNull()
 })
 it('formats for display',()=>expect(formatUsPhone('5552010142')).toBe('(555) 201-0142'))
})

describe('validateEmailSend',()=>{
 it('trims and accepts a good send',()=>{
  expect(validateEmailSend({to:' name@example.com ',subject:' Hi ',html:'Body'})).toEqual({ok:true,value:{to:'name@example.com',toName:'',subject:'Hi',html:'Body'}})
 })
 it('refuses bad input with a reason',()=>{
  expect(validateEmailSend({to:'',subject:'s',html:'b'})).toMatchObject({ok:false,error:/email address/})
  expect(validateEmailSend({to:'abc',subject:'s',html:'b'})).toMatchObject({ok:false,error:/not a valid/})
  expect(validateEmailSend({to:'a@example.com',subject:'',html:'b'})).toMatchObject({ok:false,error:/subject/})
  expect(validateEmailSend({to:'a@example.com',subject:'s',html:'  '})).toMatchObject({ok:false,error:/message/})
  expect(validateEmailSend({to:'a@example.com',subject:'x'.repeat(LIMITS.subject+1),html:'b'})).toMatchObject({ok:false,error:/too long/})
  expect(validateEmailSend({to:'a@example.com',subject:'s',html:'x'.repeat(LIMITS.emailBody+1)})).toMatchObject({ok:false,error:/too long/})
 })
})

describe('validateTextSend',()=>{
 it('normalizes the number',()=>{
  expect(validateTextSend({to:'(555) 201-0142',message:'Hi'})).toEqual({ok:true,value:{to:'5552010142',recipientName:'',message:'Hi'}})
 })
 it('refuses bad input',()=>{
  expect(validateTextSend({to:'',message:'Hi'})).toMatchObject({ok:false,error:/phone number/})
  expect(validateTextSend({to:'201-0142',message:'Hi'})).toMatchObject({ok:false,error:/10 digits/})
  expect(validateTextSend({to:'5552010142',message:''})).toMatchObject({ok:false,error:/message/})
  expect(validateTextSend({to:'5552010142',message:'x'.repeat(LIMITS.textBody+1)})).toMatchObject({ok:false,error:/too long/})
 })
})

describe('tags and bodies',()=>{
 it('escapes typed text into HTML',()=>expect(plainTextToHtml('a<b> & "c"\nnext')).toBe('a&lt;b&gt; &amp; &quot;c&quot;<br>next'))
 it('builds and recognizes test email tags',()=>{
  expect(emailTag('test','abc')).toBe('tenk:test:abc')
  expect(emailTag('Due Date!','x')).toBe('tenk:duedate:x')
  expect(isTestEmailTag('tenk:test:abc')).toBe(true)
  expect(isTestEmailTag('tenk:duedate:abc')).toBe(false)
 })
 it('prefixes test texts once',()=>{
  expect(testTextMessage('Hi')).toBe('[TenK test] Hi')
  expect(testTextMessage('[TenK test] Hi')).toBe('[TenK test] Hi')
  expect(isTestText('[TenK test] Hi')).toBe(true)
  expect(isTestText('Hi')).toBe(false)
 })
})

describe('status',()=>{
 it('reads email status',()=>{
  expect(emailStatus(true,'').status).toBe('sent')
  expect(emailStatus(false,'').status).toBe('pending')
  expect(emailStatus(true,'Send failed: bad address')).toEqual({status:'failed',detail:'Send failed: bad address'})
 })
 it('reads text status from the Twilio reply, not the Complete flag',()=>{
  expect(textStatus(null,'').status).toBe('pending')
  expect(textStatus(true,'').status).toBe('failed')
  expect(textStatus(true,'{"sid":"SM0001","status":"queued","error_code":null}')).toMatchObject({status:'sent',detail:/queued/})
  expect(textStatus(true,'{"code":21211,"message":"The To number is not a valid phone number.","status":400}')).toEqual({status:'failed',detail:'The To number is not a valid phone number. (Twilio error 21211)'})
  expect(textStatus(true,'{"sid":"SM0002","status":"failed","error_code":30003,"error_message":"Unreachable"}')).toMatchObject({status:'failed',detail:/Unreachable/})
  expect(textStatus(true,'<html>oops')).toMatchObject({status:'failed'})
 })
})
