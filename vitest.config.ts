import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['app/src/**/*.test.ts','app/src/**/*.test.tsx','platform/**/*.test.ts'],environment:'node'}})
