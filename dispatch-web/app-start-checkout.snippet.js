// Paste over live app.js `_startCheckout`. Keep £15/mo Premium copy unchanged.
async function _startCheckout(btn){
  if(!btn)return;
  btn.textContent="Redirecting to payment…";btn.disabled=true;btn.style.opacity="0.7";
  try{
    const { startCheckout } = globalThis.DispatchBilling || {};
    const run = startCheckout || (async function startCheckoutFallback(){
      const r=await fetch("/api/create-checkout",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
      const d=await r.json().catch(()=>({}));
      if(d.url)return {ok:true,url:d.url};
      if(r.status===401){
        try{
          const me=await fetch("/api/me",{credentials:"include"});
          const account=me.ok?await me.json():null;
          if(account?.checkoutSession?.url)return {ok:true,url:account.checkoutSession.url,reused:true};
          if(account?.id)return {ok:false,signedIn:true,error:d.error||"Unable to start checkout"};
        }catch{}
        return {ok:false,redirect:"/__auth/subscribe"};
      }
      return {ok:false,error:d.error||"Something went wrong"};
    });
    const result=await run({
      fetchImpl:fetch,
      locationAssign:url=>{window.location.href=url;},
      track:(name,props)=>typeof _trackDispatchEvent==="function"?_trackDispatchEvent(name,props):undefined,
    });
    if(result.ok)return;
    if(result.redirect){window.location.href=result.redirect;return;}
    btn.textContent=result.error||"Something went wrong";btn.disabled=false;btn.style.opacity="1";
  }catch{btn.textContent="Network error — try again";btn.disabled=false;btn.style.opacity="1";}
}
