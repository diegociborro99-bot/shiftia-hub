# Cuatro posts de LinkedIn listos para programar

Generados el 12 de septiembre de 2026. Cada uno pasó por dos redactores
independientes, un jurado que eligió e injertó, y un auditor adversarial que
comprobó una por una las afirmaciones contra `public/index.html`, `public/llms.txt`,
`lib/audit.js`, `lib/roster-fix.js` y el BOE. Los tres salieron con correcciones;
lo que hay abajo es la versión ya corregida.

## Cómo publicar cada uno

1. Publicar el **cuerpo** tal cual, con la **imagen** adjunta (1200x1200, en
   `linkedin-imagenes/`).
2. Inmediatamente después, escribir el **primer comentario**. El enlace va ahí y
   no en el cuerpo: LinkedIn reduce el alcance de los posts con enlace externo.
3. Publicar primero en el perfil personal de Diego y al día siguiente la versión
   de la página de empresa, según la regla del kit general.

## Reglas que cumplen los tres

- Ningún cliente nombrado: ni persona, ni empresa, ni centro, ni localidad.
- Ninguna cifra inventada. La única cifra de cliente que aparece es la hora de
  planificación para 20 operadores, que es la única que hay.
- Citas literales carácter a carácter, verificadas por `grep` contra la web.
- Texto plano, sin negrita unicode ni emojis. Entre 1.000 y 1.500 caracteres.
- 5 hashtags en español, ninguno de los prohibidos (#ia #innovacion #startup).

---

# Tres sectores, los mismos cinco problemas

- **Tipo:** Caso
- **Imagen:** `linkedin-imagenes/1-valoraciones.png`
- **Fecha sugerida:** Martes 15 de septiembre de 2026, 8:30
- **Enlace (va en el primer comentario):** https://www.shiftia.es/#voices
- **Longitud del cuerpo:** 1416 caracteres

## Cuerpo del post

```text
El cambio se pacta por WhatsApp. El cuadrante no se entera.

Es mi manera de resumir lo que nos escribieron por separado quien planifica los turnos en un restaurante de 18 trabajadores, en una plantilla industrial de 20 operadores y en un servicio hospitalario de 32 profesionales.

No se conocen entre sí. Hemos publicado sus tres valoraciones en la portada: anónimas y literales.

Describen los mismos cinco asuntos y en el mismo orden: cubrir una baja, los cambios de turno, las noches, festivos y nóminas, el reparto equilibrado y las vacaciones.

El segundo es el que más me llamó la atención.

Industria: "recibir un correo con el cambio, ir a la plantilla a modificarlos y responder al correo con la aprobación".

Hospital: "mensajes, llamadas y después actualizar la planilla para que todo quedase correcto".

Restaurante: "prácticamente todos por WhatsApp y luego había que acordarse de modificarlos en el cuadrante".

Cambia el canal, no cambia el problema: el cambio ocurre en un sitio y el cuadrante vive en otro.

Sigo de enfermero en la pública y los cinco me sonaban de memoria. Eso dice más del problema que de nosotros.

Ninguno de los tres cifra lo que ahorra en total, y lo decimos al pie. El industrial se niega expresamente: "no me atrevo a decirte tiempos".

¿Son estos tus cinco, o hay un sexto que no vi?

Enlace en comentarios.

#turnos #cuadrantes #gestiondepersonas #enfermeria #hosteleria
```

## Primer comentario

```text
Las tres valoraciones, con los cinco puntos desglosados uno a uno: https://www.shiftia.es/#voices

Son extractos literales de lo que cada responsable nos envió por escrito en septiembre, publicados sin nombre de persona, de empresa ni de centro, y sin puntuación de ningún tipo. Ninguno de los tres cifra su ahorro total, y así lo decimos al pie de la sección.

Si al leerlas echas en falta un sexto punto, cuéntamelo por aquí: me interesa más eso que los cinco que ya sé.
```

## Qué corrigió la auditoría

- **[bloqueante]** Atribuye al cliente de hostelería, como palabras suyas y por escrito, una frase que NO escribió. Lo que escribió es: «Antes los cambios se gestionaban prácticamente todos por WhatsApp y luego había que acordarse de modificarlos en el cuadrante» (index.html:921, voi3_q2). «El cambio se pacta por WhatsApp. El cuadrante no se entera.» es una reescritura de Diego. La web promete al lector que las valo
- **[importante]** Segundo error de atribución encadenado al anterior: «lo mismo nos escribieron» afirma que los otros dos clientes escribieron también esa frase. No lo hicieron. El industrial habla de correo (voi1_q2) y el hospital de mensajes y llamadas (voi2_q2); ninguno dice nada parecido a «el cuadrante no se entera». Añadido menor: una «plantilla industrial» y un «servicio hospitalario» no escriben; escribe la
- **[importante]** «Enteras» contradice lo que la propia web dice de sí misma: son EXTRACTOS literales, no las valoraciones completas (index.html:941 «Extractos literales de tres valoraciones…»; llms.txt:55 «Son extractos literales de lo que cada responsable nos envió por escrito»). Prometer el texto íntegro y que el lector encuentre extractos es una promesa incumplida en el mismo clic, y el comentario se contradice
- **[menor]** Ninguna fuente fecha la PUBLICACIÓN. Lo verificado es la fecha de recepción: «nos enviaron por escrito en septiembre de 2026» (index.html:941) y el encabezado «Valoraciones de cliente (septiembre de 2026)» (llms.txt:53). «Acabamos de publicar» es una afirmación de novedad no soportada; si la sección lleva semanas online, es falsa y comprobable abriendo la web.
- **[menor]** La fuente dice «se niega expresamente a hacerlo» (llms.txt:84) y la cita literal es «no me atrevo a decirte tiempos»: una negativa prudente y humilde, no una negativa tajante. «En redondo» endurece el tono del cliente y lo caracteriza de una forma que su propia frase desmiente en la línea siguiente.
- **[menor]** Los tres comparten la etiqueta «Noches, festivos y nóminas», pero la valoración del hospital no menciona nóminas: dice «antes de enviarlo a administración» (voi2_q3). Atribuir «para nóminas» a los tres es una extrapolación pequeña pero innecesaria, y el informe de fuentes avisa de no atribuir a estas voces integración con nómina.

---

# El corrector solo sabe hacer una cosa

- **Tipo:** Producto
- **Imagen:** `linkedin-imagenes/2-auditoria.png`
- **Fecha sugerida:** Miércoles 23 de septiembre de 2026, 8:30
- **Enlace (va en el primer comentario):** https://www.shiftia.es/recursos/auditoria-cuadrante
- **Longitud del cuerpo:** 1442 caracteres

## Cuerpo del post

```text
Nuestro corrector de cuadrantes solo sabe hacer una cosa.

Intercambiar a dos personas el mismo día. No añade turnos, no los quita, no mueve a nadie de un día a otro.

Es una limitación puesta a propósito. Si solo caben intercambios dentro del mismo día, la cobertura no se puede mover: cada día sigue teniendo la misma cantidad de gente en cada turno, solo cambia quién lo hace.

Quien ha hecho cuadrantes a mano sabe que la cobertura no se toca. Si una herramienta te rehace el mes entero sin decirte qué ha tocado y por qué, lo primero es desconfiar. Y haces bien.

Va dentro de la auditoría gratuita: subes tu planilla en PDF, Excel, CSV o una foto del papel del office y te llega el diagnóstico por email.

Los descansos por debajo de 12 horas, con la persona, la secuencia de turnos y las horas exactas. Cómo están repartidas las noches y los findes. Los tramos de siete días seguidos trabajados.

Y si el archivo se lee bien y hay margen, la propuesta corregida: en verde las celdas que cambian y, al lado, qué arregla cada una, en castellano.

Dos avisos. Esa propuesta solo se adjunta si de verdad mejora el cuadrante. Y si el archivo no se puede leer con garantías, lo revisa una persona: 24-48 h laborables.

No hay que cambiar de programa ni contratar nada. Sigues con tu Excel.

¿Qué te haría desconfiar de un cuadrante que te propone una máquina?

Enlace en comentarios.

#turnos #cuadrantes #gestiondepersonas #enfermeria #RRHH
```

## Primer comentario

```text
Aquí se sube: https://www.shiftia.es/recursos/auditoria-cuadrante

Vale el cuadrante de este mes en PDF, Excel, CSV o una foto del que tienes colgado en el office, hasta 8 MB. Si lleva nombres, tápalos o pon iniciales: para el análisis nos basta con los turnos. El archivo solo se usa para este análisis, no lo compartimos y lo eliminamos al terminar.

Sin crear cuenta. Nombre, email y sector sí: el sector es para aplicar el régimen de descansos que te toca.

Quién hace qué: la IA solo lee tu documento y transcribe los turnos. Los números (descansos, reparto de noches, rachas) los calcula un motor de reglas determinista, no la IA.

Y el aviso de siempre: el diagnóstico es informativo y no es asesoramiento legal. El Estatuto es el suelo; tu convenio puede mejorarlo y casi siempre lo hace.
```

## Qué corrigió la auditoría

- **[importante]** El post desacredita justo lo que hace la función estrella de Shiftia. ShiftiaCore se anuncia en la portada como «La IA crea el cuadrante mensual desde cero respetando convenio, equidad nocturna y restricciones individuales», el paso 2 de #how dice «si no la importas, Shiftia la crea desde cero», y la propia auditoría, en modo "proposal" (lib/roster-gen.js, asunto real del email «No nos mandaste cu
- **[importante]** Con 6 filas y 5 personas trabajando cada día, cada persona libra alrededor de un día por semana: la parrilla de ejemplo muestra gente trabajando 6 de 7 días. Es exactamente el tipo de cuadrante que audita Shiftia (descanso semanal del art. 37.1 ET: día y medio ininterrumpido, acumulable en 14 días) y el post presume de detectar rachas largas en el párrafo anterior. Un delegado sindical o un superv
- **[menor]** La frase se contradice a sí misma leída literal: si cambia quién lo hace, la gente de cada turno NO es la misma. Lo que garantiza el código es la cantidad: /home/user/shiftia-hub/lib/roster-fix.js líneas 6-8, «la composición de cada día (cuánta gente hay en cada turno) queda intacta». La copia del PDF (audit-pdf.js:678) arrastra el mismo desliz, pero en un post no hace falta heredarlo.
- **[menor]** El corrector solo se ejecuta en el camino automático (server.js ~1799-1809: se llama a fixSchedule después de que la extracción supere el umbral de confianza). Si el archivo no se puede leer, no hay propuesta corregida en absoluto, ni siquiera pasadas las 24-48 h. Tal y como está, el lector puede entender que la propuesta llega también por la vía manual.
- **[menor]** El gancho es lo único que se ve antes del «ver más» y en móvil 99 caracteres se comen el corte justo en mitad de la idea. Además la frase da la respuesta antes de que el lector sienta la curiosidad.
- **[menor]** El cuerpo del post sí lleva tildes y el comentario no: se publica en el mismo hilo y queda como escrito con prisa. En un post cuyo argumento es el rigor (números calculados por un motor determinista, no inventados), la ortografía descuidada resta justo lo que el post pide.

---

# Diez horas entre turnos: la respuesta no es sí ni no

- **Tipo:** Normativa
- **Imagen:** `linkedin-imagenes/3-descanso.png`
- **Fecha sugerida:** Martes 29 de septiembre de 2026, 8:30
- **Enlace (va en el primer comentario):** https://www.shiftia.es/recursos/auditoria-cuadrante
- **Longitud del cuerpo:** 1497 caracteres

## Cuerpo del post

```text
Sale de tarde a las 22:00 y entra de mañana a las 8:00. Son diez horas.

El artículo 34.3 del Estatuto de los Trabajadores pide doce: "entre el final de una jornada y el comienzo de la siguiente mediarán, como mínimo, doce horas".

Y cuentan desde el final efectivo del turno, no desde la hora del cuadrante: si salió a las 22:20 porque el relevo llegó tarde, desde las 22:20.

Hay una excepción que casi nadie cita: el artículo 19.2 del RD 1561/1995 permite bajar hasta siete horas el día en que se cambia de turno, compensando la diferencia hasta las doce "en los días inmediatamente siguientes".

Solo ese día y solo compensando. Fuera de ahí, con salida a las 22:00 lo más pronto que puede entrar es a las 10:00: un doblete para tapar una baja no entra en la excepción.

Y lo recortado se devuelve en descanso, no en dinero, salvo que acabe la relación laboral (art. 2 del mismo decreto).

Casi nadie llega ahí queriendo: el cuadrante salió bien, y luego una baja, dos cambios y un permiso, cada uno razonable por separado.

El Excel no avisa. Y lo digo como quien los ha hecho a mano: ese hueco no salta solo, hay que buscarlo turno a turno.

Esto es el suelo del Estatuto; en sanidad pública manda el Estatuto Marco. Y el convenio o acuerdo de tu centro puede mejorarlo: consulta el tuyo.

¿Cuántos descansos por debajo de doce horas hay en tu cuadrante de este mes?

Si quieres verlos sin contarlos a mano, enlace en comentarios.

#turnos #cuadrantes #gestiondepersonas #enfermeria #sanidad
```

## Primer comentario

```text
Aquí: https://www.shiftia.es/recursos/auditoria-cuadrante

Subes el cuadrante (PDF, Excel, CSV o una foto del de papel; un archivo, máximo 8 MB) y te llega por email el listado de descansos por debajo del mínimo —12 horas con carácter general— con la persona, la secuencia de turnos y las horas exactas, además de las rachas de noches y de cómo están repartidas las noches y los fines de semana.

Si el archivo se puede leer automáticamente lo tienes en unos minutos; si no, lo revisa el equipo y llega en 24-48 h laborables.

No hay que crear cuenta, aunque sí pedimos nombre, email y sector: el sector determina el régimen de descansos que se aplica. Puedes tapar los nombres o dejar iniciales, para el análisis basta con los turnos.

El cuadrante se usa solo para ese análisis y se elimina al terminar. El diagnóstico es informativo y no constituye asesoramiento legal.
```

## Qué corrigió la auditoría

- **[importante]** El post abre con una transición tarde→mañana y afirma en seco «Con esa salida, lo más pronto que puede entrar es a las 10:00» ANTES de introducir la excepción. Pero pasar de tarde a mañana es, en un rotativo, el día del cambio de turno: exactamente el supuesto en que el art. 19.2 del RD 1561/1995 permite bajar hasta 7 h compensando. La lámina lo agrava, porque va sola en el feed: la secuencia M T 
- **[importante]** El cuerpo dice «el artículo 34.3 del Estatuto» y cierra con «Esto es el suelo del Estatuto. Tu convenio puede mejorarlo». Los hashtags apuntan a enfermería y sanidad, que es el gremio de Diego (enfermero en activo en la sanidad pública asturiana), donde el ET no es la norma de referencia: al personal estatutario le rige el Estatuto Marco (Ley 55/2003), y su regulación no viene de un «convenio» sin
- **[menor]** El art. 2 del RD 1561/1995 dice «salvo que finalice la relación laboral», no «que acabe el contrato». No es lo mismo y es el tipo de imprecisión que un delegado señala.
- **[menor]** El propio comentario dice dos párrafos después que el sector determina el régimen de descansos aplicado, y así es en el código: lib/audit.js fija min_rest 12 con carácter general pero reduced_floor 10 en hostelería (línea 53, RD 1561/1995). Presentar el listado como «por debajo de 12 horas» sin más contradice esa frase para parte de los lectores.

---

# En nuestra web salimos los cuartos

- **Tipo:** Personal / valores
- **Imagen:** `linkedin-imagenes/4-comparativas.png`
- **Fecha sugerida:** Martes 6 de octubre de 2026, 8:30
- **Enlace (va en el primer comentario):** https://www.shiftia.es/mejores-software-turnos-espana
- **Longitud del cuerpo:** 1296 caracteres

## Cuerpo del post

```text
En nuestra web puedes leer cuándo no deberías contratarnos.

No es una forma de hablar. En la comparativa con aTurnos hay una lista de seis motivos para elegirlos a ellos. En la de Sesame HR, cinco.

Y en nuestro artículo sobre los mejores software de turnos en España salimos los cuartos de siete. Por delante van Skello, Sesame HR y Factorial.

Lo escribimos nosotros. En nuestro dominio.

Me han dicho que eso es tirarse piedras al tejado. Lo veo al revés.

Si tienes cientos de empleados en varios países, si necesitas fichaje con biometría y terminales, si tu nómina está en SAP y exiges integración: no somos tu herramienta. Y si me lo callo, lo vas a descubrir igual. Solo que en el mes tres, con el equipo dentro y la sensación de que te vendí humo.

Prefiero perder esa venta hoy que ese cliente en marzo.

Sigo de enfermero en la pública, y cuando trabajas a turnos aprendes a oler al que promete que su software lo resuelve todo. No lo resuelve todo. Resuelve una cosa.

Lo nuestro es el cuadrante 24/7: rotaciones de mañana, tarde y noche, festivos, salientes y libranzas. Eso lo hacemos bien. Lo demás lo hace mejor otro, y lo decimos.

¿Cuántas veces has contratado algo que en la demo lo hacía todo?

Enlace en comentarios.

#turnos #cuadrantes #gestiondepersonas #enfermeria #RRHH
```

## Primer comentario

```text
Las tres cosas, por si quieres comprobarlas:

El artículo donde salimos los cuartos: https://www.shiftia.es/mejores-software-turnos-espana
La comparativa con aTurnos: https://www.shiftia.es/shiftia-vs-aturnos
La comparativa con Sesame HR: https://www.shiftia.es/shiftia-vs-sesame-hr

Los motivos para elegir a otro no son de relleno: cientos de empleados en varios países, fichaje con biometría y terminales, integración con SAP o a3innuva, un pliego que exige ISO 27001. Si ese es tu caso, te va a servir más otro.

Si lo que te quita el sueño es el cuadrante 24/7, entonces sí: hablamos.
```

## Datos verificados antes de escribirlo

- El ItemList de `public/mejores-software-turnos-espana.html` ordena: 1 Skello, 2 Sesame HR, 3 Factorial, **4 Shiftia**, 5 Cuadly, 6 Bizneo HR, 7 aTurnos.
- `public/shiftia-vs-aturnos.html` tiene una lista "Elige aTurnos si…" con **6** motivos.
- `public/shiftia-vs-sesame-hr.html` tiene una lista "Elige Sesame HR si…" con **5** motivos.
- Los ejemplos citados en el post (cientos de empleados y varios países, biometría y terminales, SAP, a3innuva, ISO 27001) salen literalmente de esas dos listas.
- No se afirma nada sobre los años ni la unidad en que Diego ha hecho cuadrantes, porque eso sigue pendiente de confirmar en el kit general.

---

# Pendiente de decidir

El kit general (`linkedin-calendario-y-posts.md`) todavía nombra a dos clientes
por su nombre: **La Otra Abacería** en la semana 8 y **SPAR** en la semana 12.
Choca con la instrucción de mantener el anonimato hasta nuevo aviso. Esos dos
posts hay que reescribirlos o dejarlos en espera antes de publicarlos.
