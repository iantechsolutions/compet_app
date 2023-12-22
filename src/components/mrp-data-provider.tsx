"use client"
/* eslint-disable */

import { createContext, useContext, useEffect, useState } from "react"
import { useOnMounted } from "~/lib/hooks"
import { MRPData } from "~/mrp_data/transform_mrp_data"
import { Loader2Icon } from "lucide-react"
import { Button } from "./ui/button"
import { decodeData } from "~/lib/utils"

type CTXType = {
    data: MRPData
}

export const dataProviderContext = createContext<CTXType | null>(null)

export default function MRPDataProvider(props: { children: React.ReactNode }) {
    const [data, setData] = useState<MRPData | null>(null)
    const [loadingMessage, setLoadingMessage] = useState<string>('Buscando información')
    const [channel, setChannel] = useState(new BroadcastChannel('mrp-data'))

    function dataReady(data: MRPData) {
        setData(data)

        console.log("Data ready!", data)
        console.log("Ready to receive requests!")
        channel.onmessage = (message) => {
            if (!message.data?.type) return

            const messageData = message.data
            // MRPData response, here we don't need to do anything
            if (messageData.type === 'response') return

            // Used to find if is there some channel ready
            if (messageData.type === 'status' && messageData.action === 'request') {
                console.log("Status request received!")
                channel.postMessage({
                    action: 'response',
                    type: 'status',
                    status: 'ready'
                })
                return
            }

            // Request data
            if (messageData.type === 'request' && messageData.action === 'request') {
                console.log("Data request received!")
                channel.postMessage({
                    action: 'response',
                    type: 'response',
                    data: data
                })
            }
        }

        setLoadingMessage('Datos listos')
    }

    function tryRequestData() {
        return new Promise<MRPData | null>((resolve, reject) => {
            let timer: any = -1
            console.log("Waiting for status")

            // Here we need to wait for a response, if we receive a status response
            // it means that the channel is ready to receive a request
            channel.onmessage = (message) => {
                if (!message.data?.type) return

                if (message.data.type === 'response' && message.data.action === 'response') {
                    console.log("Data received from channel!", message.data.data)
                    setLoadingMessage('Datos recibidos')
                    resolve(message.data.data)

                } else if (message.data.type === 'status' && message.data.status === 'ready' && message.data.action === 'response') {
                    console.log("Channel ready! Requesting data...")
                    setLoadingMessage('Esperando datos de otra pestaña')
                    clearTimeout(timer)

                    channel.postMessage({
                        action: 'request',
                        type: 'request',
                    })
                }
            }

            console.log("Requesting status...")
            channel.postMessage({
                action: 'request',
                type: 'status',
            })

            timer = setTimeout(() => {
                channel.onmessage = null
                console.log("Timeout! No response received")
                resolve(null)
            }, 500)
        })
    }

    async function handleMounted() {
        try {
            let data = await tryRequestData()

            if (data) {
                return dataReady(data)
            }

            setLoadingMessage('Esperando al servidor')
            const res = await fetch('/api/data/mrp')
            setLoadingMessage('Descargando datos')
            const raw = await res.text()
            setLoadingMessage('Decodificando datos')
            return dataReady(decodeData(raw))
        } catch (error) {
            alert('Error al descargar los datos: ' + error)
            window.location.reload()
        }
    }

    useOnMounted(() => {
        void handleMounted()
    })

    if (!data) return <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center">
        <Button variant="secondary" disabled><Loader2Icon className="animate-spin mr-2" /> {loadingMessage}</Button>
    </div>

    return <dataProviderContext.Provider value={{ data }}>
        {props.children}
    </dataProviderContext.Provider>
}

export function useMRPData() {
    const ctx = useContext(dataProviderContext)
    if (!ctx) {
        throw new Error('useMRPData must be used within a MRPDataProvider')
    }
    return ctx.data
}