export function gmailDeliveryResult(complete:boolean|null,error:string):{status:'sent'|'failed'|'submitted';detail:string}{
 if(complete===true)return {status:'sent',detail:'Accepted by Gmail. Inbox delivery is not confirmed.'}
 if(complete===false&&error){
  const reconnect=/AUTH FAILED|refresh token|re-authoriz|reconnect|invalid_grant/i.test(error)
  return {status:'failed',detail:reconnect?'Your Google account needs to be connected again in staff Google Settings.':'The Gmail sender reported a failure. Ask the site administrator to check this send in Gmail Log.'}
 }
 return {status:'submitted',detail:'Submitted to the existing Gmail sender. Its result is still pending.'}
}
