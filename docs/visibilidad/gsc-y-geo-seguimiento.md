# Kit Search Console + vigilancia GEO — bloque 4 del plan de visibilidad

Este documento desarrolla los pasos 4.1 (diagnóstico en Google Search Console) y 4.2 (vigilancia GEO: qué dicen ChatGPT, Claude, Perplexity y Gemini sobre Shiftia) del plan. Va acompañado del fichero `tracker-visibilidad-shiftia.xlsx` (misma carpeta), donde se apunta todo el seguimiento del plan: directorios, reseñas, prensa, LinkedIn, GEO y quick wins de GSC.

Tiempo total: 10 min el día que se hace el diagnóstico + 15 min al mes para la vigilancia GEO. Coincide con los "25 min/mes" del resumen de esfuerzo del plan.

Todo lo que aquí se dice de Shiftia sale de la ficha de marca. Los datos que faltan van entre corchetes, tipo `[DATO]`, y al final hay una lista de lo que Diego tiene que rellenar.

---

## 1. Diagnóstico en Google Search Console (10 min)

Requisito: tener la propiedad `shiftia.es` verificada en https://search.google.com/search-console. Si aún no lo está, lo más rápido es la propiedad de dominio (registro TXT en el DNS); si el DNS lo gestiona Highkey Labs, pedírselo a ellos. Todo lo que sigue asume que hay al menos 3 meses de datos.

### 1.1 Abrir el informe correcto (1 min)

1. Menú lateral izquierdo → **Rendimiento** → **Resultados de búsqueda**.
2. Barra de filtros superior → clic en **Fecha: últimos 3 meses** → pestaña **Filtrar** → elegir **Últimos 3 meses** → **Aplicar**.
3. Para ver la tendencia: mismo botón de fecha → pestaña **Comparar** → **Comparar los últimos 3 meses con el periodo anterior** → **Aplicar**. Cada fila mostrará el dato actual, el del periodo anterior y la diferencia.
4. Filtro **Tipo de búsqueda: Web** (el que viene por defecto). No hace falta tocar nada más.

### 1.2 Activar las 4 métricas (10 s)

Encima del gráfico hay cuatro casillas: **Total de clics**, **Total de impresiones**, **CTR medio** y **Posición media**. Por defecto solo están activas las dos primeras. Marca las cuatro: sin CTR y posición no se pueden detectar los quick wins ni los títulos que fallan.

### 1.3 Pestaña Consultas y orden por impresiones (1 min)

1. Debajo del gráfico están las pestañas **Consultas · Páginas · Países · Dispositivos · Apariencia en búsqueda · Fechas**. Clic en **Consultas**.
2. Clic en la cabecera **Impresiones** para ordenar de mayor a menor (un segundo clic invierte el orden).
3. Abajo a la derecha, **Filas por página** → 100 o 250, para no paginar.

### 1.4 Filtros con expresiones regulares (2 min)

El filtro de consulta admite regex. Barra de filtros → **+ Nuevo** → **Consulta** → en el desplegable, en vez de "Consultas que contienen", elegir **Personalizada (regex)** → **Coincide con la expresión regular** → pegar la expresión → **Aplicar**. GSC usa sintaxis RE2 y distingue mayúsculas de minúsculas, por eso todas empiezan por `(?i)`.

| Para qué | Regex | Uso |
|---|---|---|
| Consultas de marca (con las erratas habituales) | `(?i)shiftia\|shifia\|siftia\|shifita\|shiftya\|shitia` | Termómetro de notoriedad. Apuntar clics e impresiones cada mes en la pestaña "Resumen" del tracker (fila "Impresiones de marca"). |
| Excluir la marca (solo tráfico no de marca) | misma regex, pero eligiendo **No coincide con la expresión regular** | Para que los quick wins no se mezclen con búsquedas de quien ya nos conoce. |
| Sector residencias | `(?i)residencia\|geriátric\|geriatric\|gerocultor\|mayores\|sociosanitari` | Mide si la página `/software-turnos-residencias` empieza a recibir impresiones. |
| Sector enfermería / clínicas | `(?i)enfermer\|hospital\|clínica\|clinica\|sanitari\|planilla` | Idem para `/cuadrantes-enfermeria-clinicas`. |
| Sector hostelería | `(?i)hosteler\|restaurante\|bar\b\|hotel\|cocina\|turno partido` | Idem para `/turnos-hosteleria`. |
| Intención comercial (quien ya busca software) | `(?i)software\|programa\|app\|herramienta\|aplicación\|aplicacion` | Estas son las consultas que convierten; priorízalas en los quick wins. |
| Competidores | `(?i)aturnos\|sesame\|factorial\|bizneo\|resiturn` | Mide si las páginas `/shiftia-vs-...` aparecen por búsquedas de alternativas. |
| Normativa (tráfico informacional de /recursos) | `(?i)descanso\|jornada\|convenio\|registro horario\|estatuto\|noches` | Para ver qué guías tiran y decidir la siguiente de /recursos. |

Truco: combinar un filtro de **Consulta** con un filtro de **Página** (por ejemplo, página que contiene `/recursos/`) para ver qué consultas trae cada guía.

### 1.5 Criterios: qué es un quick win y qué es un título roto (3 min)

Con la tabla ordenada por impresiones y las cuatro métricas activas, recorre las filas de arriba abajo y apunta en la pestaña **"GSC quick wins"** del tracker:

**Quick win = posición media entre 4 y 15 con 20 impresiones o más en 3 meses.**
Google ya considera la página relevante pero no la muestra arriba del todo. Acción: poner la consulta exacta en el título (H1 y `<title>`) y en el primer párrafo de la página que ya posiciona (pestaña **Páginas** con el filtro de esa consulta te dice cuál es). No crear una página nueva: se canibalizarían.

**Título roto = CTR por debajo del 2 % en posición 1-5.**
Estamos arriba y no nos hacen clic: el título o la meta description no venden. Acción: reescribir con beneficio + precio (`desde 29 €/mes`) siguiendo la ficha de la sección 2. Excepción: consultas puramente informativas donde el resultado se resuelve en la propia SERP (por ejemplo "descanso mínimo entre turnos horas"); ahí un CTR bajo es normal y el gancho no es el precio sino la herramienta gratis.

**Marca.** Filtra con la regex de marca y anota impresiones y clics del trimestre comparado con el anterior. Si las impresiones de marca crecen mes a mes, los bloques 1 y 2 del plan están funcionando aunque el tráfico total no se mueva.

Orden de prioridad si hay muchos candidatos: 1) quick wins con intención comercial, 2) títulos rotos en páginas comerciales (home, sectores, comparativas), 3) quick wins informacionales, 4) el resto.

### 1.6 Exportar a Google Sheets (30 s)

Arriba a la derecha de la tabla → **Exportar** → **Google Sheets** (o **Descargar CSV** / **Descargar Excel**). Se exporta lo que está filtrado en ese momento, con las cuatro métricas. Copiar las filas candidatas a la pestaña "GSC quick wins" del tracker; no hace falta guardar la exportación entera.

Recomendación: hacer una exportación completa (sin filtros, 3 meses) el primer día de cada trimestre y guardarla en Drive con el nombre `gsc-consultas-AAAA-MM.csv`. Es la única forma de conservar histórico más allá de los 16 meses que guarda GSC.

### 1.7 Pedir indexación manual de las 9 URL nuevas (3 min, una vez)

Las páginas del bloque 3 del plan que hay que pedir indexar cuando Highkey Labs las publique (los tres últimos slugs son los que ya usa el kit de LinkedIn; si Highkey Labs elige otros, cambiarlos aquí y en el tracker):

1. https://www.shiftia.es/software-turnos-residencias
2. https://www.shiftia.es/cuadrantes-enfermeria-clinicas
3. https://www.shiftia.es/turnos-hosteleria
4. https://www.shiftia.es/shiftia-vs-aturnos
5. https://www.shiftia.es/shiftia-vs-sesame-hr
6. https://www.shiftia.es/mejores-software-turnos-espana
7. https://www.shiftia.es/recursos/turnos-rotativos-convenio-2026
8. https://www.shiftia.es/recursos/registro-horario-residencias
9. https://www.shiftia.es/recursos/reparto-equitativo-de-noches

Cómo se pide, URL por URL:

1. Pegar la URL completa en la barra superior de GSC (**Inspeccionar cualquier URL en "shiftia.es"**) y pulsar Intro.
2. Esperar el resultado. Si dice **"La URL no está en Google"**, clic en **Solicitar indexación**. Google hace una comprobación en directo de 1-2 minutos y confirma que la ha puesto en cola.
3. Si dice **"La URL está en Google"** pero el contenido ha cambiado, clic en **Probar URL publicada** y después en **Solicitar indexación** para que recoja la versión nueva.
4. Límite orientativo: unas 10-12 solicitudes al día por propiedad. Con 9 URL entra en un solo día; si aparece "Se ha superado la cuota", seguir al día siguiente.

Antes de pedir indexación, comprobar dos cosas en cada URL con la propia herramienta de inspección: que **"¿Se permite el rastreo?"** diga "Sí" (ninguna de las 9 puede llevar `<meta name="robots" content="noindex">`) y que la URL canónica declarada sea ella misma.

Además, una sola vez: **Indexación → Sitemaps** → escribir `sitemap.xml` en el campo "Añadir un sitemap" → **Enviar**. La web genera `https://www.shiftia.es/sitemap.xml` de forma dinámica; hay que asegurarse con Highkey Labs de que las 9 URL nuevas están incluidas en él el día que se publiquen.

### 1.8 Comprobar la cobertura (informe "Páginas")

En las versiones actuales de GSC "Cobertura" se llama **Indexación → Páginas**.

- Arriba muestra dos cifras: **No indexadas** e **Indexadas**. Debajo, la tabla "Por qué las páginas no se indexan" con los motivos.
- Las 9 URL nuevas tienen que pasar a "Indexadas" en 1-2 semanas. Para verlo sin buscar entre todas: clic en **Ver datos sobre las páginas indexadas** y filtrar por URL, o volver a inspeccionar la URL directamente.
- Motivos que sí importan si aparecen para páginas nuestras: **"Descubierta: actualmente sin indexar"** (Google la conoce pero no le ha dado prioridad; enlázala desde la home y desde /recursos y vuelve a pedir indexación en 7 días), **"Rastreada: actualmente sin indexar"** (la ha leído y no la considera suficiente; revisar que la página tenga contenido propio, no plantilla vacía), **"Página con redirección"** o **"Duplicada, el usuario no ha indicado ninguna versión canónica"** (avisar a Highkey Labs).
- Motivos que se pueden ignorar: páginas de login, dashboard, recuperación de contraseña y similares que llevan `noindex` a propósito.

Revisión rápida: cada vez que se haga el protocolo GEO mensual (sección 3), abrir "Páginas" y comprobar que la cifra de "Indexadas" no ha bajado.

---

## 2. Ficha de reescritura de títulos y metas

### 2.1 Fórmula

**Título (`<title>` y, normalmente, H1):**
`[consulta exacta] + [beneficio concreto o gancho] + | Shiftia` en páginas comerciales; en guías de /recursos, `[consulta exacta] + [año o herramienta gratis]`, sin marca si no cabe.

**Meta description:**
`[qué obtiene quien entra, en presente] + [prueba: convenio, equidad, IA] + [precio o gratis] + [cierre: sin permanencia / demo sin registro / sin registro]`.

Reglas:
- Título: 50-60 caracteres (Google corta hacia los 580 px, que suelen ser 60-65 caracteres; con mayúsculas anchas menos). La consulta va al principio.
- Meta: 140-155 caracteres. En móvil se corta antes, así que el precio o el "gratis" tiene que estar en los primeros 100.
- Precio solo con la frase permitida por la ficha: "desde 29 €/mes" (con espacio antes del símbolo). Nunca "gratis" para el producto: gratis son la demo, la auditoría, la plantilla y las calculadoras.
- No prometer lo que no está en la ficha (ni fichaje propio, ni app en tiendas, ni cifras de clientes).
- Un título por página: si dos páginas compiten por la misma consulta, se decide cuál se queda con ella y la otra se orienta a otra consulta.
- Al cambiar un título, apuntar la fecha en la pestaña "GSC quick wins" y revisar la posición y el CTR a los 30 días (columna "Posición +30 días"). Si el CTR no ha subido, probar un segundo gancho; no cambiar títulos cada semana.

Las longitudes de abajo son las reales (contadas carácter a carácter, espacios incluidos). Los "antes" son los títulos y metas que hay hoy en la web.

### 2.2 Ejemplo 1 — /recursos/descanso-minimo-entre-turnos (página informacional con herramienta)

| | Antes | Después |
|---|---|---|
| Título | Descanso mínimo entre turnos: qué dice la ley en España (2026) — 62 car. | Descanso mínimo entre turnos 2026: ley y calculadora gratis — 59 car. |
| Meta | Guía clara del descanso mínimo entre turnos en España: Estatuto de los Trabajadores, Estatuto Marco sanitario, convenios colectivos y excepciones. Con ejemplos reales de enfermería, fábrica y seguridad. — 202 car. (Google la corta) | Cuántas horas de descanso hay entre turnos según el Estatuto de los Trabajadores, el Estatuto Marco y tu convenio. Calculadora gratis y ejemplos reales. — 152 car. |

Por qué: aquí el gancho no es el precio (quien busca esto no busca software todavía), es la calculadora, que ninguna guía legal de la competencia tiene. La meta empieza respondiendo la pregunta tal como se formula ("cuántas horas") y cabe entera.

### 2.3 Ejemplo 2 — /recursos/excel-vs-software-turnos (comparativa, intención mixta)

| | Antes | Después |
|---|---|---|
| Título | Excel vs software de turnos: cuándo basta y cuándo no — 53 car. | Excel vs software de turnos: cuándo basta y cuándo no (2026) — 60 car. |
| Meta | Cuándo Excel es suficiente para planificar turnos y cuándo necesitas un software. Guía honesta para fábricas, residencias, hospitales, seguridad, hostelería y cualquier empresa con cuadrantes. — 192 car. | Cuándo te basta Excel para el cuadrante y cuándo no. Comparativa honesta, plantilla Excel gratis y software de turnos con IA desde 29 €/mes. — 140 car. |

Por qué: el título ya era bueno (consulta exacta al principio, promesa honesta); solo se añade el año, que sube el CTR en consultas de comparación. La meta pasa de listar sectores a ofrecer las dos salidas del artículo: la plantilla gratis (para quien se queda en Excel) y el precio (para quien ya no). Esta es la página donde más sentido tiene "desde 29 €/mes".

### 2.4 Ejemplo 3 — Home (https://www.shiftia.es/)

| | Antes | Después |
|---|---|---|
| Título | Shiftia — Planificación inteligente de turnos y planillas — 57 car. | Software de turnos con IA desde 29 €/mes \| Shiftia — 50 car. |
| Meta | Shiftia: planificación completa de turnos y cuadrantes con IA. Ausencias, vacaciones, rotaciones y reglas de convenio — tu propia plantilla, sin ETT. Tarifa plana desde 29€/mes, sin coste por trabajador. — 203 car. | Genera el cuadrante mensual en segundos respetando el convenio y reparte las noches con equidad. Desde 29 €/mes, sin permanencia. Demo sin registro. — 148 car. |

Por qué: nadie busca "Shiftia" salvo quien ya nos conoce, y esos hacen clic igual. La home tiene que ganar la consulta "software de turnos" (y sus variantes "software de turnos con IA", "software turnos"), así que la consulta va delante y la marca detrás. El precio en el título es el gancho del plan. Ojo: el `og:title` de la home ("Shiftia — Planificación de turnos simplificada con IA") es otro texto distinto; conviene alinearlo con el título nuevo en el mismo cambio. La meta actual dice "29€/mes" sin espacio; la ficha usa "29 €/mes".

Nota para Highkey Labs: el script `scripts/verify-pages.js` comprueba que el `<title>` no pase de 70 caracteres y que la meta description tenga entre 70 y 165; los tres títulos y las tres metas nuevas cumplen.

---

## 3. Protocolo GEO mensual (15 min)

GEO = cómo nos describen y si nos recomiendan los asistentes de IA. No se puede "posicionar" ahí directamente; lo que se puede hacer es medirlo cada mes y corregir las fuentes que citan. Cuando los directorios (bloque 1), la prensa (bloque 2) y las comparativas (bloque 3) estén publicados, aquí es donde se verá el salto.

### 3.1 Cuándo y cómo

- **Día fijo: el primer lunes laborable de cada mes**, a primera hora. Si cae festivo, el martes. Anotar el mes en formato `AAAA-MM` en la pestaña "GEO mensual" del tracker (viene precargada con septiembre de 2026).
- **Cuatro motores**, en este orden y con estas condiciones:
  1. **ChatGPT** con la **búsqueda web activada** (icono del globo / "Buscar en la web" en la caja de texto; si no se activa, contesta de memoria y no cita fuentes). Usar un **chat temporal** para que no influya el historial.
  2. **Claude** (claude.ai) con la búsqueda web activada en los ajustes del chat. Conversación nueva por cada pregunta.
  3. **Perplexity**, modo de búsqueda normal (no "Investigación"). Es el que más fuentes muestra: apuntarlas todas.
  4. **Gemini** (gemini.google.com). Conversación nueva por cada pregunta.
- **Una pregunta por conversación**, copiada literalmente de la lista (sin añadir "por favor" ni contexto). Si el motor pide aclaraciones, responder "España, empresa de 20-50 trabajadores" y apuntar la respuesta que dé después.
- **Captura de pantalla** de cada respuesta, guardada en Drive como `geo/AAAA-MM/motor-numeroconsulta.png`. Es la única prueba que queda: las respuestas cambian de un día para otro.
- Sesión cerrada o cuenta que no haya buscado "Shiftia" antes, si es posible; los motores personalizan. Lo ideal: que lo haga siempre la misma persona en las mismas condiciones para que la serie sea comparable.

### 3.2 Las 11 consultas

Las tres del plan:

1. mejor software de turnos para residencias en España
2. alternativas a aTurnos
3. software cuadrantes enfermería

Residencias:

4. programa para hacer el cuadrante de una residencia de mayores
5. software de turnos para gerocultoras y auxiliares en residencias

Enfermería / clínicas:

6. software para planificar turnos de enfermería en una clínica privada
7. herramienta para repartir las noches de forma equitativa entre enfermeras

Hostelería:

8. software de turnos para restaurantes en España
9. app para hacer cuadrantes de hostelería con turno partido

Marca:

10. qué es Shiftia
11. Shiftia opiniones

11 consultas × 4 motores = 44 respuestas al mes. A unos 20 segundos por respuesta, 15 minutos.

### 3.3 Qué apuntar en cada respuesta

Una fila por consulta y motor en la pestaña "GEO mensual" del tracker:

| Columna | Qué poner |
|---|---|
| Aparece | Sí / No. "Sí" solo si nombra a Shiftia sin que se lo pidamos (en las consultas de marca, si la describe correctamente). |
| Posición | Orden en que nos cita entre las herramientas que nombra (1 = la primera). Vacío si no aparece. En las consultas de marca, 1 si nos identifica bien. |
| Herramientas citadas | Todas las que nombra, en orden, separadas por comas (aTurnos, Sesame HR, Factorial, Bizneo, ResiTurn, etc.). Sirve para saber contra quién competimos en cada motor. |
| Fuentes citadas (URL) | Las URL que muestra como fuente, separadas por espacios. Si no muestra ninguna, "sin fuentes". Es la columna más importante: nos dice dónde hay que estar (sección 4). |
| Precio correcto | Sí / No / No lo menciona. Correcto = "desde 29 €/mes", tarifa plana, sin coste por trabajador. |
| Descripción correcta | Sí / Parcial / No. Correcta = software de planificación de turnos con IA, para la plantilla propia, español. Incorrecta = nos llama ETT, bolsa de personal, marketplace, app de fichaje, o nos ubica fuera de España. |
| Puntuación 0-10 | Según la rúbrica de abajo. |
| Notas | Frase textual llamativa (buena o mala), errores concretos, si nos confunde con otra marca. |

### 3.4 Rúbrica de puntuación (0-10 por consulta y motor)

| Criterio | Puntos |
|---|---|
| Nombra a Shiftia | 3 |
| Posición entre las herramientas citadas: 1.ª = 3 · 2.ª-3.ª = 2 · 4.ª o peor = 1 | hasta 3 |
| Descripción correcta (2) o parcial pero sin errores graves (1). Si nos llama ETT o bolsa de personal: 0 | hasta 2 |
| Precio correcto o, si no lo menciona, ningún precio falso | 1 |
| Cita al menos una fuente de terceros (directorio, prensa, comparativa) además de shiftia.es | 1 |

Si no aparece: 0 en todo (aunque la respuesta sea buena para otros). Máximo 10.

Lectura del total mensual (media de las 44 filas, la calcula el tracker en la pestaña "Resumen"):
- 0-1: invisibles. Normal al empezar; los bloques 1 y 2 aún no han hecho efecto.
- 2-4: aparecemos en algunas consultas, sobre todo de marca y sector sanitario.
- 5-7: nos citan en la mayoría de consultas sectoriales con descripción correcta. Objetivo a 6 meses.
- 8-10: primera o segunda opción en las consultas comerciales. Objetivo a 12 meses.

También conviene mirar la media por motor: Perplexity y ChatGPT con búsqueda reflejan los directorios y la prensa en semanas; Gemini y Claude tardan más y dependen más de la web propia y de llms.txt.

### 3.5 Cómo pedir corrección cuando citan datos erróneos

No hay un formulario en el que decirle a ChatGPT que se equivoca. Lo que funciona es corregir la fuente que cita, porque es lo que vuelven a leer:

1. **Identificar la fuente.** En la columna "Fuentes citadas" está la URL de donde ha sacado el dato malo. Si no muestra fuentes, buscar la frase errónea entre comillas en Google: casi siempre sale de un directorio o de un artículo antiguo.
2. **Si la fuente es nuestra web** (precio antiguo, función que ya no se llama así, página desactualizada): corregir la página y, en el mismo día, `public/llms.txt`. Este fichero es el que lee cualquier motor que siga la convención `llms.txt`; tiene que decir siempre lo mismo que la landing (precios, funciones, "no es una ETT"). Después, pedir indexación de la página en GSC (sección 1.7).
3. **Si la fuente es un directorio** (SoftDoit, Capterra, Crunchbase…): entrar en la extranet del directorio y corregir la ficha. Las plataformas suelen tardar unos días en publicar el cambio.
4. **Si la fuente es un artículo de terceros** (listado, blog, prensa): escribir al autor con el dato correcto y el enlace a la fuente oficial (la landing o `/#pricing`). Plantilla en la sección 4.1; añadir una línea: "En vuestro artículo aparece [dato erróneo]; el dato actual es [dato correcto], como puede verse en [URL]".
5. **Si no hay fuente y el error es de "memoria" del modelo** (típico: describirnos como ETT o bolsa de personal): no hay corrección directa. Lo que ayuda es que la descripción correcta esté repetida con las mismas palabras en la home, en `llms.txt`, en `/sobre-nosotros`, en los directorios y en LinkedIn. En Perplexity y Gemini se puede usar el pulgar abajo con el motivo "información incorrecta"; no garantiza nada, pero es gratis.
6. **Apuntar la corrección** en la columna "Notas" del tracker y volver a lanzar esa consulta al mes siguiente para ver si ha cambiado.

Errores que vigilar especialmente porque contradicen la ficha: llamarnos ETT o marketplace; decir que tenemos fichaje o app nativa en tiendas; inventar precios por trabajador; ubicarnos fuera de Oviedo; atribuirnos clientes que no son los cinco de la ficha.

---

## 4. Qué hacer con los resultados

La columna "Fuentes citadas" del tracker es la lista de sitios donde tenemos que estar. Cada mes, agrupar las URL citadas en tres tipos y actuar así:

### 4.1 Citan un listado o comparativa donde no estamos → pedir inclusión

Buscar en la página el nombre del autor o el correo de contacto del medio (pie de página, "Sobre nosotros", LinkedIn del autor). Enviar este correo de 6 líneas, sin adjuntos:

> **Asunto:** Propuesta para vuestro artículo "[TÍTULO DEL ARTÍCULO]"
>
> Hola [NOMBRE],
> he leído vuestra comparativa "[TÍTULO]" y creo que a vuestros lectores les puede interesar una opción más: Shiftia (shiftia.es), software español de planificación de turnos con IA que genera el cuadrante completo respetando el convenio y propone 3 candidatos de la propia plantilla cuando hay una baja.
> Tarifa plana desde 29 €/mes sin coste por trabajador, sin permanencia y con demo sin registro en shiftia.es/demo; lo usan desde un servicio de un hospital público hasta supermercados y hostelería.
> Si os encaja, os paso capturas, ficha de funciones y acceso a una demo en directo cuando queráis.
> Gracias por vuestro tiempo y un saludo,
> Diego Ciborro · Director de Shiftia · 663 50 46 47

Reglas: un solo correo y un recordatorio a los 10 días; no ofrecer pago ni intercambio de enlaces; si el listado es de pago (patrocinado), anotarlo en el tracker y decidir aparte. Apuntar el envío en la pestaña "Prensa" del tracker con sección "Listado/comparativa".

### 4.2 Citan un directorio → completar la ficha y pedir reseñas allí

- Si aún no tenemos ficha en ese directorio: darse de alta (añadir una fila en la pestaña "Directorios" del tracker). Los precargados en el tracker son los del plan; si un motor cita otro que no está, ese pasa a ser prioridad.
- Si ya tenemos ficha: comprobar que la descripción, el precio ("desde 29 €/mes", tarifa plana), la sede (Oviedo), las categorías (gestión de turnos, residencias, enfermería) y las capturas están completos. Las fichas incompletas se citan menos que las completas.
- Pedir a los clientes de la pestaña "Reseñas" que dejen su reseña en **ese** directorio en concreto (los mensajes están en `resenas-mensajes.md`). Los motores citan con más confianza las fichas con reseñas.

### 4.3 Citan nuestra propia web → asegurarse de que la página está al día

- Abrir la URL citada y comprobar precio, nombres de funciones y clientes contra la ficha de marca. Si el motor cita una guía de /recursos, comprobar que el año del título y de la normativa son los vigentes.
- Comprobar que `llms.txt` dice lo mismo que esa página.
- Si la página citada es una guía informacional (descanso mínimo, equidad nocturna…), aprovechar: añadir o revisar el bloque final que enlaza a la demo y a la auditoría gratuita, porque el lector que llega desde la IA ya viene con la pregunta resuelta y solo le falta el siguiente paso.
- Si citan la home o `/#pricing` con un precio antiguo, es que tienen una copia cacheada: pedir indexación de nuevo en GSC y esperar al mes siguiente.

### 4.4 Cierre mensual (5 min)

Rellenar la pestaña "Resumen" del tracker no requiere nada: las fórmulas cuentan solas. Lo único manual: las impresiones y clics de marca del mes (sección 1.5) y una línea de "qué ha cambiado este mes" en la celda de notas. Con eso, cada mes se ve en una pantalla: directorios publicados, reseñas conseguidas, prensa respondida, posts publicados, puntuación GEO media y quick wins pendientes.

---

## Lista de marcadores que Diego debe rellenar

| Marcador | Dónde | Qué poner |
|---|---|---|
| ~~`[TELÉFONO]`~~ | Plantilla de email de la sección 4.1 | Resuelto: 663 50 46 47 (ya sustituido en la plantilla). |
| `[NOMBRE]`, `[TÍTULO DEL ARTÍCULO]` | Plantilla 4.1 | Se rellenan en cada envío. |
| Slugs 7-9 de la lista de la sección 1.7 | Sección 1.7 y pestaña "GSC quick wins" | Confirmar con Highkey Labs los slugs definitivos de las tres guías nuevas de /recursos. |
| Enlace de reseña de Google y de Capterra | Pestaña "Reseñas" del tracker | Se obtienen como explica `resenas-mensajes.md`, sección 1. |
| Contacto / email de cada medio | Pestaña "Prensa" del tracker | Email de redacción o formulario de contacto de cada medio, copiado de su web (no se han inventado). |
| Nombre y cargo del contacto de cada cliente | Pestaña "Reseñas" | Solo para uso interno del tracker. |
| Impresiones y clics de marca | Pestaña "Resumen", fila "Marca (GSC)" | Dato de GSC con la regex de marca, cada mes. |
| Fecha de verificación de la propiedad en GSC | Sección 1 | Si la propiedad no está verificada, pedir a Highkey Labs el registro TXT. |
