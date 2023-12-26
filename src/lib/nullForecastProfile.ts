import { ForecastProfile } from "~/mrp_data/transform_mrp_data";

export const nullProfile: ForecastProfile = {
    salesIncrementFactor: 0,
    clientInclusionList: null,
    includeSales: false,
    name: 'Sin forecast',
    budgetsInclusionFactor: 0,
    includeBudgets: false,
}