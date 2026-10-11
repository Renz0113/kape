(() => {
  const API_BASE = window.KapeConfig?.apiBaseUrl || `${location.pathname.startsWith('/kape/') ? '/kape' : ''}/api/v1`;
  let csrfToken = sessionStorage.getItem('kape-csrf') || '';
  async function csrf(force=false) {
    if (force) csrfToken = '';
    if (!csrfToken) {
      const r=await fetch(`${API_BASE}/csrf`,{credentials:'same-origin',cache:'no-store'});
      const j=await r.json().catch(()=>null);
      if (!r.ok || !j?.data?.csrf_token) throw new Error(j?.error?.message||'Could not verify your session. Refresh and try again.');
      csrfToken=j.data.csrf_token;
      sessionStorage.setItem('kape-csrf',csrfToken);
    }
    return csrfToken;
  }
  async function request(path, options={}) {
    const isFormData=typeof FormData!=='undefined'&&options.body instanceof FormData;
    const headers={'Accept':'application/json',...(options.body&&!isFormData?{'Content-Type':'application/json'}:{}),...(options.headers||{})};
    const method=(options.method||'GET').toUpperCase();
    const writes=!['GET','HEAD','OPTIONS'].includes(method);
    if(writes) headers['X-CSRF-Token']=await csrf();
    const requestOptions={credentials:'same-origin',cache:'no-store',...options,headers};
    let response=await fetch(`${API_BASE}${path}`,requestOptions);
    let result=await response.json().catch(()=>({error:{message:'The server returned an invalid response.'}}));
    // A login or session refresh can rotate the server token while another tab
    // still has an older one. Re-fetch and retry once only when CSRF failed.
    if(writes && response.status===403 && result.error?.code==='CSRF_FAILED') {
      headers['X-CSRF-Token']=await csrf(true);
      response=await fetch(`${API_BASE}${path}`,requestOptions);
      result=await response.json().catch(()=>({error:{message:'The server returned an invalid response.'}}));
    }
    if(result.data?.csrf_token){csrfToken=result.data.csrf_token;sessionStorage.setItem('kape-csrf',csrfToken);}
    if(!response.ok){const error=new Error(result.error?.message||'Request failed.');error.status=response.status;throw error;}
    return result.data;
  }
  window.KapeAPI={request,csrf,base:API_BASE};
})();
