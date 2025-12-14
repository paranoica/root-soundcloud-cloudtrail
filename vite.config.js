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

            const loaderSrc = resolve(__dirname, "src/content/loader.js");
            const loaderDestDir = resolve(distDir, "src/content");

            if (!existsSync(loaderDestDir))
                mkdirSync(loaderDestDir, { recursive: true });

            if (existsSync(loaderSrc)) {
                copyFileSync(loaderSrc, resolve(loaderDestDir, "loader.js"));
            }

            const copyList = [
                { src: "manifest.json", dest: "manifest.json" },
                { src: "_locales", dest: "_locales" },
                { src: "assets", dest: "assets" },
                { src: "src/styles", dest: "src/styles" },
                { src: "src/popup/styles", dest: "src/popup/styles" },
                { src: "src/dashboard/styles", dest: "src/dashboard/styles" },
                { src: "src/content/inject.js", dest: "src/content/inject.js" }
            ];

            copyList.forEach(({ src, dest }) => {
                const source = resolve(__dirname, src);
                if (existsSync(source)) {
                    statSync(source).isDirectory() ? copyDirSync(source, resolve(distDir, dest)) : copyFileSync(source, resolve(distDir, dest));
                }
            });
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
                    if (chunkInfo.name === "background")
                        return "src/background/index.js";

                    if (chunkInfo.name === "content")
                        return "src/content/index.js";

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