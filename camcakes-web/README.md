# Camcakes · Monitor web

Visor para administradores del `Monitor_Operacion_CamCakes.xlsx`: **Menú**, **Costos** e **Inventario**.
No guarda nada: los archivos se cargan en el navegador y se pueden volver a exportar.

    npm install
    npm run dev      # desarrollo
    npm run build    # genera dist/ (estático, base './')
    npm test         # valida el motor contra los valores de Excel

Flujo: cargar Monitor → (opcional) cargar DOC de Zettle → Inventario > Teórico / Ventas del POS / Conteo físico
→ imprimir hoja de conteo → capturar conteo → Exportar Monitor (opción "Cerrar periodo").
