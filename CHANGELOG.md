# CHANGELOG MRP 

## [1.4.0] WIP (acordarse de cambiar versión!!)
### Arreglado
- Stock tango en tabla de recortes ahora se lee de tango
- Filtrar por artículo (tal cual como aparece en consults menos los que no tienen recortes cargados) en tabla recortes

## [1.3.0]
### Agregado
- Loader al realizar recorte.
- Columnas de stock físico, stock tango y diferencia en la tabla de recortes.
- Ordenamiento por cualquier columna en tabla de recortes clickeando el nombre de la columna.
- Mostrar entrada del recorte si no hay para el semielaborado en consultas.
- Indicador de versión bajo el título.

### Cambios
- Mejorado formato de fechas de fechas de entrada en consultas (DD-MM-YYYY) sacada de la fecha de llegada de la importación.
- Removido texto de consumido en popup de recortes usados en consultas.

### Arreglado
- Recortado de recortes, solo se agrega el sobrante y lo recortado se borra (antes no se eliminaba/consumía lo recortado y había que borrarlo a mano).
- Se muestra la cantidad correcta de en recortes expresados en piezas/unidades/kits.
- Ya no se muestra una cantidad incorrecta de stock al consultar por varios productos en consultas.
- Ahora se muestran los productos con fecha de llegada este mes sin importar qué día en consultas (ej. 5 05104EDMSA2283 salía sin entrada pero en la tabla dice que hay).
- Arreglado un filtrado incorrecto que hacía que algunos pedidos y clientes no aparezcan (ej. DPEC en 08210).
- Arreglado problema donde las consultas de varios productos no consideraban cuánto se consumiría en total. 

## [1.2.0]
### Arreglado
- Uso de facturaciones en estadísticas generales.
- Piso/redondeo sobre ventas a clientes.