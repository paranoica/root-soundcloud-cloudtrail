import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";

function copyDirSync(src, dest) {
    if (!existsSync(src))
        return;

    if (!existsSync(dest))
        mkdirSync(dest, { recursive: true });

    const entries = readdirSync(src); for (const entry of entries) {
        const srcPath = resolve(src, entry);
        const destPath = resolve(dest, entry);

        if (statSync(srcPath).isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

function copyStaticFiles() {
    return {
        name: "copy-static-files",
        writeBundle() {
            const distDir = resolve(__dirname, "dist");
            if (!existsSync(distDir)) {
                mkdirSync(distDir, { recursive: true });
            }

            const manifestSrc = resolve(__dirname, "manifest.json"); if (existsSync(manifestSrc)) {
                copyFileSync(manifestSrc, resolve(distDir, "manifest.json"));
            } else {
                console.error("File manifest.json not found!");
            }

            const localesSrc = resolve(__dirname, "_locales"); if (existsSync(localesSrc)) {
                copyDirSync(localesSrc, resolve(distDir, "_locales"));
            }

            const assetsSrc = resolve(__dirname, "assets"); if (existsSync(assetsSrc)) {
                copyDirSync(assetsSrc, resolve(distDir, "assets"));
            }

            const stylesSrc = resolve(__dirname, "src/styles"); if (existsSync(stylesSrc)) {
                copyDirSync(stylesSrc, resolve(distDir, "src/styles"));
            }

            const popupStylesSrc = resolve(__dirname, "src/popup/styles"); if (existsSync(popupStylesSrc)) {
                copyDirSync(popupStylesSrc, resolve(distDir, "src/popup/styles"));
            }

            const dashStylesSrc = resolve(__dirname, "src/dashboard/styles"); if (existsSync(dashStylesSrc)) {
                copyDirSync(dashStylesSrc, resolve(distDir, "src/dashboard/styles"));
            }
        }
    };
}

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, "src/popup/index.html"),
                dashboard: resolve(__dirname, "src/dashboard/index.html"),
                background: resolve(__dirname, "src/background/index.js"),
                content: resolve(__dirname, "src/content/index.js"),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === "background") {
                        return "src/background/index.js";
                    }

                    if (chunkInfo.name === "content") {
                        return "src/content/index.js";
                    }

                    return "assets/[name]-[hash].js";
                },
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash].[ext]",
            },
        },
        minify: false,
        sourcemap: false,
    },
    plugins: [copyStaticFiles()],
});