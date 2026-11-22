# Guía sencilla de Camcakes · Monitor

Esta guía explica para qué sirve cada sección y cómo usar el sistema sin conocimientos técnicos. El Monitor reúne información del menú, los costos, las ventas y el inventario.

## Antes de empezar

Ten a la mano estos archivos:

1. **Monitor de operación (`.xlsx`)**: es el archivo principal. Contiene los productos, las recetas, los insumos, los precios y otros datos del negocio.
2. **Reporte “Ventas por producto” del punto de venta (`.xlsx`)**: es opcional para revisar el menú y los costos, pero necesario para calcular el consumo teórico de inventario según las ventas de un periodo.

El sistema trabaja con los archivos en el navegador. No los sube a un servidor ni los guarda en una base de datos.

## Empezar una sesión

1. Al abrir la página, selecciona el archivo **Monitor_Operacion_CamCakes.xlsx**.
2. Si ya tienes el reporte del punto de venta, también puedes cargarlo. Si no, puedes agregarlo después desde la parte superior o desde **Inventario → Ventas del POS**.
3. Cuando el Monitor termine de cargarse, usa las secciones **Menú**, **Costos** e **Inventario** de la barra superior.

Si reemplazas el Monitor por otro archivo, el sistema vuelve a tomar ese archivo como base y reinicia las capturas físicas del inventario de la sesión. Antes de reemplazarlo, descarga cualquier cambio que quieras conservar.

## Monitores y trazabilidad

Esta sección genera una estructura ZIP para organizar los Excel por periodo.

- Selecciona el primer mes y el último mes.
- El sistema crea una carpeta por cada mes con formato **AAAA-MM**, por ejemplo **2026-02**.
- Las carpetas se generan vacías; no incluyen copias del Monitor ni datos del negocio.
- Se recomienda descargar la estructura una sola vez y guardarla en la ubicación principal donde se conservarán los archivos.
- Dentro de cada periodo, guarda el Monitor correspondiente, el reporte del POS y el conteo físico.
- Antes de trabajar, carga el Monitor actual desde la carpeta correspondiente a ese periodo.

Los periodos mejoran la trazabilidad y reducen el riesgo de mezclar datos de meses diferentes. No reemplazan el respaldo del Monitor exportado ni deben usarse para borrar información.

## Menú

Esta sección sirve para consultar los productos que se venden.

- Usa el buscador para encontrar un producto o ingrediente.
- Usa los botones de categoría para filtrar la lista.
- Activa o desactiva **Mostrar costos** para ocultar o ver el costo y el porcentaje que representa respecto al precio neto.
- Selecciona un producto para ver su precio, receta, costo estimado y variantes del punto de venta, si las hay.

### Actualizar el menú desde el Excel oficial

1. En **Menú**, selecciona **Importar menú oficial** y carga el archivo `.xlsx` descargado del sistema oficial.
2. La página agrupa las variantes por producto y sugiere coincidencias usando el nombre, precio y categoría. La sugerencia no modifica nada por sí sola.
3. Para cada producto, elige una acción:
   - **Vincular y actualizar precio**: conserva el nombre y la receta usados por el Monitor; actualiza el precio base. Si también quieres cambiar la categoría, activa esa opción y elige una categoría.
   - **Agregar como nuevo**: agrega el nombre, precio, categoría y tipo elegidos. El producto queda sin receta; complétala después en **Costos → Recetas**.
   - **Descartar**: no incorpora ese producto.
4. Los precios de las variantes se muestran para consulta. Se usa como precio base el de la variante con leche entera, si existe; de lo contrario, se usa el primer precio del archivo.
5. Exporta el Monitor para guardar los cambios aprobados. Agregar un producto no crea automáticamente su receta ni sus variantes del POS.
6. La página muestra las categorías encontradas en el archivo. También puedes crear una categoría propia en esta pantalla; para guardarla en el Excel, asígnala a un producto que agregues o a uno vinculado y exporta el Monitor.

El producto **Crepa Make Your Own** puede aparecer con precio **$0** en el archivo oficial porque se usa para agregar rellenos y toppings. Al vincularlo con el MYO existente, la página conserva su precio de menú del Monitor.

El indicador de costo es una referencia para identificar productos cuyo costo ocupa una parte alta del precio. No sustituye una revisión de precios y gastos del negocio.

## Costos

En **Costos** puedes revisar y ajustar la información que se usa para calcular el costo de preparación.

### Productos

Muestra el precio de menú, el precio neto sin IVA, el costo de producir cada producto, la utilidad estimada y el porcentaje de costo. Puedes ordenar la tabla seleccionando los encabezados y filtrar por categoría.

La **meta de costo** sirve como referencia visual para comparar productos. Es una meta de análisis; no cambia los precios ni las recetas.

### Insumos y precios

Aquí se mantienen los ingredientes y materiales usados por las recetas.

- **Contenido**: cantidad que trae una presentación, por ejemplo, gramos o mililitros.
- **Precio**: costo de compra de esa presentación.
- **Real / Estimado**: indica si el precio es un dato confirmado o aproximado.
- **Peso por pieza**: se usa cuando el insumo se cuenta por piezas y hace falta convertirlo a gramos.
- **Uso mín. y máx.**: cantidades habituales por porción.
- **MYO mín. y máx.**: cantidades usadas para calcular los ingredientes de Make Your Own.

Al activar **Mostrar porciones de uso** aparecen campos adicionales para las cantidades de uso. Para agregar un insumo, selecciona **Agregar insumo**, completa categoría y nombre, y agrega los datos de presentación que conozcas. El nombre debe ser único.

También puedes cambiar directamente el nombre o la categoría de un insumo en su fila. Al renombrar un insumo, la aplicación actualiza automáticamente las recetas, los nombres relacionados de parámetros y las referencias del catálogo Zettle que usan ese insumo.

Para crear una categoría sin asignarla todavía a un insumo, escribe su nombre en **Nueva categoría** y selecciona **Crear categoría**. La categoría quedará disponible en los filtros y en el Excel exportado. Para renombrar una categoría completa, selecciónala y escribe el nuevo nombre en el administrador de categorías.

Si falta un precio o una cantidad necesaria, algunos costos pueden aparecer como incompletos. Revisa primero el insumo señalado y su receta.

### Recetas

Selecciona un producto para ver y editar sus ingredientes.

- **Cantidad manual vacía**: usa la cantidad estándar del insumo o el reparto establecido para los rellenos.
- **Cantidad manual con un valor**: usa esa cantidad solo para el producto seleccionado.
- **Agregar**: añade a la receta un insumo que ya exista.
- El botón de papelera quita una línea de receta.
- También puedes ajustar el precio del producto y si incluye nieve o crema batida, cuando corresponda.

Los cambios se reflejan en los cálculos del sistema y se incluyen al exportar el Monitor.

### Make Your Own

Es una calculadora para probar combinaciones de rellenos, toppings, nieve y crema. Selecciona las opciones para ver cómo cambia el costo.

Si los toppings seleccionados superan el límite, la calculadora reduce sus cantidades proporcionalmente para respetar el tope configurado. Los resultados son una simulación; no agregan automáticamente una combinación nueva al menú.

### Ventas del periodo

Después de cargar el reporte del punto de venta, aquí puedes consultar las ventas identificadas, su costo calculado y su utilidad estimada para el periodo del archivo.

Las ventas que no se pudieron relacionar con un producto no descuentan insumos hasta que se revisen en **Inventario → Ventas del POS**. Las variantes de leche del reporte se usan para ajustar el costo y mover el consumo de leche entera a la leche elegida.

Para Make Your Own, el interruptor de **Ventas del POS** define si cada línea de relleno también descuenta la base de una crepa (masa, nieve, crema y empaque). Déjalo activado cuando el POS reporte los rellenos y toppings por separado y no reporte otra línea para la base.

En el Excel exportado, la hoja **Ventas** también detecta tipos de leche escritos en la columna de variante; un valor manual en **AF** tiene prioridad. Si el producto tiene otro nombre en el reporte, asígnalo en **F** para que se calcule con su receta.

### Parámetros

Permite revisar o cambiar datos generales usados por los cálculos:

- gramos de relleno total por crepa;
- límite de gramos para toppings de Make Your Own;
- porcentaje de IVA incluido en el precio de menú;
- costo del empaque por crepa.
- piezas incluidas en el kit de empaque por crepa.

Modifica estos valores solo si sabes que la regla de operación cambió.

## Inventario

El inventario tiene tres pestañas: **Teórico**, **Ventas del POS** y **Conteo físico**.

### Teórico

El teórico estima cuánto debería quedar de cada insumo después de las ventas del periodo:

**Stock inicial + compras − consumo estimado por ventas = stock teórico**

- **Stock inicial** se captura con dos campos: **Cerradas** cuenta presentaciones completas y **Abierta** escribe lo que queda en g, ml o piezas. Por ejemplo, aceite con una presentación cerrada y 113 g abiertos se captura como Cerradas 1 y Abierta 113. Para insumos como la masa, puede capturarse directamente en su medida original.
- Las **Cerradas** solo aceptan números enteros de presentaciones o paquetes completos. La unidad visible indica si el insumo se cuenta en g, ml o piezas, y evita mezclar unidades.
- Debajo de las cantidades cerradas y abiertas aparece la operación visual, por ejemplo `5 × 235 g = 1175 g`, `+ 113 g abierta` y `Total: 1288 g`. Para insumos por piezas se muestra el mismo cálculo con piezas y paquetes.
- En el campo **Abierta** también puedes escribir sumas como `340+113`; el sistema convierte el total a presentaciones completas y cantidad abierta.
- **Compras** se mantiene en número de presentaciones cerradas, porque normalmente se reciben botes o paquetes completos.
- **Consumo por ventas** se calcula con las recetas y las ventas reconocidas.
- **Teórico** muestra la cantidad estimada restante en la unidad del insumo.
- **Mínimo** es el nivel mínimo que deseas mantener; se captura en gramos, mililitros o piezas según el insumo.
- La alerta ayuda a ubicar insumos agotados o por debajo del mínimo.

Selecciona el consumo de un insumo para ver qué productos contribuyen a ese cálculo. Sin el reporte del punto de venta, el consumo por ventas es cero.

### Ventas del POS

Esta pestaña muestra las líneas del reporte clasificadas como **Identificadas**, **Sin identificar** o **Ignoradas**.

- Las identificadas se relacionan con un producto o una opción del catálogo y descuentan insumos según la receta.
- Para una línea sin identificar, usa **Asignar a** para elegir el producto correcto. También puedes elegir **Ignorar** si esa línea no debe afectar el inventario.
- Si una asignación manual ya no es necesaria, selecciona **Automático**.
- La lista de productos ignorados permite dejar de ignorar un nombre o agregar otro.
- La opción de Make Your Own indica si cada venta de relleno debe descontar también la base de masa, nieve y crema.
- Puedes reemplazar el reporte del punto de venta desde esta pestaña.

Revisa las líneas sin identificar antes de confiar en el consumo teórico. Una asignación incorrecta puede cambiar el consumo calculado.

### Conteo físico

Sirve para comparar lo que realmente se encontró con lo que calcula el sistema.

1. Puedes imprimir la hoja de conteo o descargar el **formato Excel** o **CSV**.
2. En la hoja, escribe:
   - **Cerradas**: cuántas presentaciones completas hay.
   - **Abierta**: cuánto queda en la presentación abierta, en gramos, mililitros o piezas, según el insumo.
3. Guarda el archivo y cárgalo en **Cargar conteo físico**. También puedes llenar los campos directamente en la tabla de la página.
4. El sistema relaciona cada fila con el inventario usando el nombre del insumo. Procura no cambiar esos nombres.
5. Revisa el valor contado y la diferencia frente al teórico. Una diferencia negativa significa que hay menos de lo esperado; una positiva, que hay más.

El formato CSV puede abrirse en Excel u otra hoja de cálculo. También se puede cargar el **comparativo CSV** que se descarga desde esta sección. El formato acepta cantidades con decimales y delimitadores comunes de coma o punto y coma.

Puedes filtrar la hoja impresa por categoría, ocultar el teórico con **Conteo ciego**, incluir solo insumos con stock o consumo, escribir quién cuenta y quitar insumos que no deseas incluir. **Restaurar todos** vuelve a mostrar los insumos quitados.

La diferencia valorizada estima en dinero cuánto representa la diferencia física frente al teórico, cuando el insumo tiene costo conocido.

## Guardar cambios y evitar perderlos

Los cambios se guardan temporalmente en el almacenamiento de la pestaña del navegador. Si recargas la página en esa misma pestaña, el Monitor intenta recuperar el archivo cargado, las ediciones y las capturas. No se guardan en una cuenta ni se sincronizan con otros dispositivos.

Al cerrar la pestaña o el navegador, estos datos temporales normalmente se eliminan. Por eso:

- Descarga el **Monitor actualizado** antes de cerrar si necesitas conservar tus cambios.
- Descarga también cualquier formato de conteo o archivo de resultados que quieras archivar.
- Si el navegador avisa que el almacenamiento temporal está lleno, exporta el Monitor antes de recargar.

El navegador puede mostrar una confirmación si intentas cerrar o salir con cambios pendientes.

## Exportar el Monitor actualizado

Selecciona **Exportar Monitor** en la parte superior para descargar un nuevo archivo Excel con los cambios hechos en el sistema. El archivo conserva la estructura del Monitor original; el navegador no modifica el archivo original guardado en tu computadora.

En la ventana de exportación puedes elegir:

- **Cerrar periodo**: utiliza el conteo físico cuando exista; para los insumos sin conteo usa el teórico. Escribe ese resultado como nuevo stock inicial y vacía las compras para preparar el siguiente periodo.
- **Vaciar la hoja Ventas**: quita los datos de ventas capturados en esa hoja del Monitor. Esta opción es independiente del reporte del punto de venta cargado en la página.

Revisa las opciones antes de descargar. Si marcas **Cerrar periodo**, asegúrate de haber revisado el conteo y el teórico: la opción prepara un nuevo stock inicial en el archivo exportado.

Las ventas del reporte del punto de venta sirven para calcular el inventario teórico en la aplicación, pero no se copian a la hoja Ventas del Monitor.

## Términos que aparecen en la aplicación

| Término | Significado sencillo |
|---|---|
| **POS** | Sistema o punto de venta donde se registran las ventas. |
| **DOC del POS** | Reporte Excel de “Ventas por producto”; en esta guía se refiere al archivo del reporte, no a un documento de Word. |
| **Teórico** | Cantidad que se estima que debería quedar según existencias, compras y ventas. |
| **Conteo físico** | Cantidad que una persona cuenta directamente en el negocio. |
| **Presentación** | Empaque en el que se compra un insumo, como una bolsa, botella o caja. |
| **Cerradas** | Número de presentaciones completas que aún no se han abierto. |
| **Abierta** | Cantidad restante en una presentación ya abierta. |
| **MYO / Make Your Own** | Producto que permite elegir rellenos y toppings. |
| **Costo estimado** | Cálculo aproximado cuando falta un precio o dato confirmado. |

## Insumos sin receta

La pestaña **Sin receta** muestra insumos registrados que no aparecen en una receta, una opción Make Your Own con porción definida, el kit de empaque ni los parámetros generales. Sirve para revisar si hacen falta:

- agregar el insumo a un producto;
- confirmarlo como insumo de venta directa;
- añadirlo al kit de empaque o a otra configuración especial.

La tabla incluye categoría, presentación, contenido y stock inicial. Al seleccionar **Agregar a receta**, puedes continuar en la pestaña **Recetas**.

## Generar PDF

En la sección **Costos**, el botón **Generar PDF** abre el cuadro de impresión del navegador. Selecciona **Guardar como PDF** para obtener un archivo. El contenido impreso corresponde a la pestaña actualmente abierta:

- **Productos:** resumen de precios y márgenes.
- **Recetas:** receta, cantidades y costo por producto.
- **Insumos y precios:** catálogo, presentaciones y costos.
- **Sin receta:** insumos que no aparecen en una receta.

Los valores se toman del cálculo actual y no modifican el Monitor ni los datos temporales.

## Rutina recomendada para cada periodo

1. Carga el Monitor actualizado del periodo.
2. Carga el reporte del punto de venta.
3. Revisa y asigna las ventas sin identificar.
4. Confirma los precios, recetas, stock inicial y compras.
5. Consulta el inventario teórico.
6. Imprime o descarga la hoja de conteo; registra las cantidades físicas.
7. Carga el Excel o CSV del conteo y revisa las diferencias.
8. Exporta el Monitor actualizado. Solo marca **Cerrar periodo** cuando estés listo para pasar el conteo al stock inicial del siguiente periodo.
