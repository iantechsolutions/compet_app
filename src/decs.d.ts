class Scaledrone {
    constructor(channelId: string, options?: any)

    clientId: string

    on(event: string, callback: (error: any) => void): void

    authenticate(token: string): void

    publish(options: {
        room: string
        message: any
    }): void

    subscribe(room: string): {
        on(event: string, callback: (message: any) => void): void
    }
}

declare module 'scaledrone-node' {
    export default Scaledrone
}

declare global {
    const Scaledrone: typeof Scaledrone
}

// declare module "json-complete" {
//     declare function encode<T>(obj: T): string
//     declare function decode<T>(str: string): T

//     export { encode, decode }
// }
