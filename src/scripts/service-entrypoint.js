import { spawn } from 'child_process'
import path from 'path'
// @ts-ignore
import log from 'node-file-logger'

log.SetUserOptions({
    folderPath: path.resolve('./logs/'),
})

function runProcess() {
    return new Promise((resolve, reject) => {
        const child = spawn('C:\\Program Files\\nodejs\\node.exe', [
            'C:\\Program Files\\nodejs\\node_modules\\npm\\index.js',
            'run',
            'listen-load-data',
        ])

        child.stdout.on('data', (data) => {
            log.Info(`${data}`)
        })

        child.stderr.on('data', (data) => {
            log.Error(`stderr: ${data}`)
        })

        child.on('close', (code) => {
            log.Info(`child process exited with code ${code}`)
            resolve(code)
        })

        child.on('error', (err) => {
            reject(err)
        })
    })
}

/**
 * Delay function
 * @param {number} ms - milliseconds
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
    setInterval(
        () => {
            log.Info('MRP corriendo ok', new Date())
        },
        1000 * 60 * 60,
    )

    while (true) {
        log.Info('Starting process')
        try {
            await runProcess()
        } catch (error) {
            log.Info('Error running process')
            log.Info(error)
        }
        log.Info('Waiting 5 seconds')
        await delay(5000)
    }
}

process.on('uncaughtException', (err) => {
    log.Error('FATAL: uncaughtException', err)
})

main()
