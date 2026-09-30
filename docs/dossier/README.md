# Dossier comercial

Fuente del PDF que se publica en `/dossier-shiftia.pdf`.

`dossier.html` son once páginas A4 con CSS de impresión (`@page { size: A4 }`);
cada `.page` mide exactamente 210×297 mm. Las imágenes son capturas reales del
producto, no ilustraciones.

Para regenerarlo hace falta Chromium y las fuentes servidas en local:

    await page.pdf({ path: 'dossier.pdf', format: 'A4',
                     printBackground: true,
                     margin: { top:0, right:0, bottom:0, left:0 } })

Al tocarlo, revisar página a página que nada desborde: `.page` lleva
`overflow:hidden`, así que un bloque que se pase no da error, simplemente se
corta. Las portadas (1 y 11) desbordan a propósito: es el símbolo decorativo.

Cifras delicadas que NO deben cambiarse sin comprobarlas:

- Precios: los de `public/index.html` (29/69/129 €, −20% anual).
- La estimación de 18 h/mes y 4.801 €/año es un cálculo propio de Shiftia
  (reducción media del 70%), y el dossier lo dice expresamente. No es un dato
  de clientes ni de auditoría externa.
- Las valoraciones son extractos literales y anónimos. Ninguna cuantifica su
  ahorro total: la única cifra citable es la hora de planificación para 20
  operadores.
