import { ForecastProfile } from "~/mrp_data/transform_mrp_data";

export const nullProfile: ForecastProfile = {
    budgetsInclusionFactor: 0,
    clientInclusionList: null,
    includeSales: false,
    name: 'default',
    salesIncrementFactor: 0,
    includeBudgets: false,
}