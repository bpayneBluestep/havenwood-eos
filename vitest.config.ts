import {defineConfig} from 'vitest/config'
export default defineConfig({esbuild:{jsx:'automatic'},test:{include:['app/src/**/*.test.ts','app/src/**/*.test.tsx','platform/**/*.test.ts'],environment:'node'}})
