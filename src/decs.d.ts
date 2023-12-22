declare module "json-complete" {
    declare function encode<T>(obj: T): string
    declare function decode<T>(str: string): T

    export { encode, decode }
}

