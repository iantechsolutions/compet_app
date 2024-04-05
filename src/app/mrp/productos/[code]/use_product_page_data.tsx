import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useMRPData } from '~/components/mrp-data-provider'
import type { MRPProduct, ProductEvent } from '~/mrp_data/transform_mrp_data'

export function useProductPageData(product: MRPProduct) {
    const data = useMRPData()

    return useMemo(() => {
        const events = data.eventsByProductCode.get(product.code) ?? []

        const dataByMonth = new Map<string, { events: ProductEvent[]; supplyForecastEvents: ProductEvent[] }>()

        for (const event of events) {
            const month = dayjs(event.date).format('YYYY-MM')

            const data = dataByMonth.get(month) ?? {
                events: [],
                supplyForecastEvents: [],
            }

            if (event.type === 'supply' && event.isForecast) {
                data.supplyForecastEvents.push(event)
            } else {
                data.events.push(event)
            }

            dataByMonth.set(month, data)
        }

        return dataByMonth
    }, [product, data])
}
