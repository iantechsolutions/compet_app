import { spawn } from 'child_process'


function runProcess() {
    return new Promise((resolve, reject) => {
        const child = spawn('C:\\Program Files\\nodejs\\node.exe', ['C:\\Program Files\\nodejs\\node_modules\\npm\\index.js', 'run', 'listen-load-data'])

        child.stdout.on('data', (data) => {
            console.log(`${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            resolve(code);
        });

        child.on('error', (err) => {
            reject(err);
        });
    })
}

/**
 * Delay function
 * @param {number} ms - milliseconds
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
    while (true) {
        console.log('Starting process')
        try {
            await runProcess()
        } catch (error) {
            console.log('Error running process')
            console.log(error)
        }
        console.log('Waiting 5 seconds')
        await delay(5000)
    }
}

main()
