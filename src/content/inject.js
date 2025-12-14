export function injectScript(code) {
    return new Promise((resolve, reject) => {
        try {
            const script = document.createElement("script"); script.textContent = code;

            script.onload = () => {
                script.remove();
                resolve();
            };

            script.onerror = (error) => {
                script.remove();
                reject(error);
            };

            (document.head || document.documentElement).appendChild(script);

            if (!script.src) {
                script.remove();
                resolve();
            }
        } catch (error) {
            reject(error);
        }
    });
}

export function injectFunction(fn, ...args) {
    return new Promise((resolve, reject) => {
        const messageId = `ct_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const handler = (event) => {
            if (event.data?.messageId === messageId) {
                window.removeEventListener("message", handler);
                if (event.data.error) {
                    reject(new Error(event.data.error));
                } else {
                    resolve(event.data.result);
                }
            }
        };

        window.addEventListener("message", handler); setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Injection timeout"));
        }, 5000);

        const code = `
            (function() {
                try {
                    const fn = ${fn.toString()};
                    const result = fn(${args.map(a => JSON.stringify(a)).join(", ")});

                    window.postMessage({ messageId: "${messageId}", result: result }, "*");
                } catch (error) {
                    window.postMessage({ messageId: "${messageId}", error: error.message }, "*");
                }
            })();
        `;

        injectScript(code).catch(reject);
    });
}
export function getPageValue(path) {
    return injectFunction((p) => {
        const parts = p.split(".");
        let value = window;

        for (const part of parts) {
            if (part === "window")
                continue;

            if (value === undefined)
                return undefined;

            value = value[part];
        }
        return value;
    }, path);
}