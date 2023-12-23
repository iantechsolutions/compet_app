import { configDotenv } from "dotenv";
configDotenv()

// IMPORTANTE PARA QUE FUNCIONE EN NODE,
// SE TTIENE QUE LLAMAR A configDotenv ANTES DE IMPORTAR NADA QUE REQUIRE ENV
const { env } = await import("~/env")

console.log(env)



// import { queryBaseMRPData } from "~/mrp_data/query_mrp_data"
// import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data"
// import { ForecastParams, transformMRPData } from "~/mrp_data/transform_mrp_data"
// import jsonComplete from 'json-complete'
// import { decodeData, encodeData } from "~/lib/utils"

// const fdp: ForecastParams = {
//     incrementFactor: 0.01
// }

// const q = await queryBaseMRPData()
// const fd = await queryForecastData(fdp)

// const t = transformMRPData(q, fd, fdp)

// console.log("A")
// const t1 = Date.now()

// const encoded = encodeData(t)

// const t2 = Date.now()
// console.log("B")
// console.log(t2 - t1)


// const decode = decodeData(encoded)

// const t3 = Date.now()
// console.log("C")
// console.log(t3 - t2)