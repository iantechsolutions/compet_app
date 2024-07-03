QUERY MRP DATA
- obtiene datos del mrp del archivo desde uploadthing y aplica algunas transformaciones básicas
QUERY FORECAST DATA
- también usa los datos del mrp anteriores pero extrae los que necesita para el forecast y hace algunas transformaciones
TRANSFORM MRP DATA
- Utiliza los datos base y los datos del forecast (los dos anteriores) y aplica transforamciones complejas,
   referencias y más cosas para que sea facil el consumo de la info


RUTA /api/data/mrp

1. Autenticar
2. Obtener perfil de forecast
3. QUERY MRP DATA (datos base)
4. QUERY FORECAST DATA
5. TRANSFORM MRP DATA
6. La data transformada se encodea con una funcion especial que mantiene 'Date', 'Map' y referencias circualres se envía a cliente