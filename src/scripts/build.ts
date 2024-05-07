import Bun, { $ } from 'bun'

const define = {
    'process.env.SCALEDRONE_SECRET': JSON.stringify(Bun.env.SCALEDRONE_SECRET!),
    'process.env.SCALEDRONE_CHANNEL_ID': JSON.stringify(Bun.env.SCALEDRONE_CHANNEL_ID!),
    'process.env.CONNECTION_QUERY': JSON.stringify(Bun.env.CONNECTION_QUERY!),
    'process.env.POSTGRES_URL': JSON.stringify(Bun.env.POSTGRES_URL!),
    'process.env.UPLOADTHING_SECRET': JSON.stringify(Bun.env.UPLOADTHING_SECRET!),
    'process.env.UPLOADTHING_APP_ID': JSON.stringify(Bun.env.UPLOADTHING_APP_ID!),
}

const result = await Bun.build({
    entrypoints: ['./src/scripts/listen-load-data.ts'],
    target: 'bun',
    outdir: './dist/scripts',
    define,
})

if (!result.success) {
    console.error('Error building script: ', result.logs)
    process.exit(1)
}

await $`bun build ./dist/scripts/listen-load-data.js --compile --target bun --outfile dist/listen-load-data.exe`

const result2 = await Bun.build({
    entrypoints: ['./src/scripts/load-data.ts'],
    target: 'bun',
    outdir: './dist/scripts',
    define,
})

if (!result2.success) {
    console.error('Error building script: ', result2.logs)
    process.exit(1)
}

await $`bun build ./dist/scripts/load-data.js --compile --target bun --outfile dist/load-data.exe`
