(function() {
    if (window.__cloudtrail_intercepted)
        return;
    window.__cloudtrail_intercepted = true;

    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    function isSCApi(url) {
        return url && (
            url.includes("api-v2.soundcloud.com") || 
            url.includes("api.soundcloud.com")
        );
    }
    
    function extractClientId(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get("client_id");
        } catch {
            return null;
        }
    }
    
    function postToExtension(type, data) {
        window.postMessage({
            source: "cloudtrail-interceptor",
            type: type,
            data: data
        }, "*");
    }
    
    window.fetch = async function(...args) {
        const url = args[0]?.url || args[0];
    
        if (typeof url === "string" && isSCApi(url)) {
            const clientId = extractClientId(url);
            if (clientId) {
                postToExtension("CLIENT_ID", { clientId });
            }
            
            try {
                const response = await originalFetch.apply(this, args);
                const clone = response.clone();

                if (url.includes("/tracks") || url.includes("/stream") || url.includes("/play-history")) {
                    clone.json().then(data => {
                        if (data) {
                            postToExtension("API_RESPONSE", { 
                                url, 
                                data
                            });
                        }
                    }).catch(() => {});
                }
                
                return response;
            } catch (error) {
                throw error;
            }
        }
        
        return originalFetch.apply(this, args);
    };
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._cloudtrailUrl = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        const url = this._cloudtrailUrl;
        
        if (typeof url === "string" && isSCApi(url)) {
            const clientId = extractClientId(url);
            if (clientId) {
                postToExtension("CLIENT_ID", { clientId });
            }
            
            this.addEventListener("load", function() {
                try {
                    if (this.responseText && (this.responseType === "" || this.responseType === "text")) {
                        if (url.includes("/tracks") || url.includes("/stream") || url.includes("/play-history")) {
                            const data = JSON.parse(this.responseText); 
                            postToExtension("API_RESPONSE", { 
                                url, 
                                data
                            });
                        }
                    }
                } catch (e) { }
            });
        }
        
        return originalXHRSend.apply(this, args);
    };
    
    if (window.__sc_hydration) {
        postToExtension("HYDRATION_DATA", window.__sc_hydration);
    }
})();