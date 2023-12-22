import * as flatted from 'flatted'

const map = new Map()

map.set('foo', 'bar')

const data: Record<string, any> = { foo: 'bar', map }
// data['baz'] = data


console.log(data)
const e = flatted.stringify(data, (key, value) => {
    if (value instanceof Map) {
        return {
            $: "Map",
            value: [...value.entries()],
        }
    }

    if(value instanceof Date) {
        return {
            $: "Date",
            value: value.getTime(),
        }
    }

    return value
})
console.log(e)
console.log(flatted.parse(e, (key, value) => {
    if (value && value.$ === 'Map') {
        return new Map(value.value)
    }

    if (value && value.$ === 'Date') {
        return new Date(value.value)
    }

    return value
}))