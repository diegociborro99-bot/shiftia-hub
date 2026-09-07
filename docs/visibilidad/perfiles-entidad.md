# Kit de perfiles de entidad — Shiftia

Desarrolla el **paso 2.3** del plan de visibilidad (Crunchbase, Product Hunt, Wikipedia) y apoya el **paso 1.3** (Perfil de empresa en Google). Todos los textos están listos para pegar; el recuento de caracteres aparece junto a cada uno.

Fuente de verdad: `ficha-marca.md`. Nada de lo que hay aquí afirma sobre Shiftia algo que no esté en la ficha. Los marcadores entre corchetes `[ASÍ]` son datos que Diego debe rellenar antes de publicar; al final de cada bloque hay una nota con lo que falta.

Orden sugerido (una tarde): 1) Google Business Profile → 2) LinkedIn (ya existe, solo optimizar) → 3) Crunchbase → 4) Wikidata → 5) añadir el bloque `sameAs` a la web → 6) Product Hunt, solo si se decide lanzar.

---

## 1. Google Business Profile (paso 1.3)

Alta en https://business.google.com. Tipo de negocio: **empresa de servicios sin local abierto al público** (ocultar dirección exacta; indicar zona de servicio). Google pedirá verificación (vídeo, teléfono o correo postal); tener a mano un documento con la razón social y la dirección.

### 1.1 Datos básicos

| Campo | Valor |
|---|---|
| Nombre del negocio | `Shiftia` (solo la marca; Google penaliza añadir palabras clave al nombre) |
| Categoría principal | **Empresa de software** |
| Categorías secundarias | Empresa de desarrollo de software · Servicio de informática (no marcar "Consultoría de recursos humanos": Shiftia no presta consultoría) |
| Dirección | Oviedo, Asturias. Marcar "Presto servicios a clientes en su ubicación" y ocultar la dirección postal. Zona de servicio: **España** |
| Teléfono | +34 663 50 46 47 |
| Web | `https://www.shiftia.es` |
| Enlace de cita/demo | `https://www.shiftia.es/demo` |
| Horario | `[HORARIO: p. ej. L-V 9:00-18:00]` (Google muestra "Cerrado" fuera de horario; si se prefiere, no poner horario) |
| Fecha de apertura | `[AÑO/MES DE FUNDACIÓN: confirmar]` |
| Razón social (privado, para verificación) | Highkey Labs Software Solutions |

### 1.2 Descripción del negocio (límite 750 caracteres) — **741 caracteres**

```
Shiftia es un software español de planificación de turnos y cuadrantes con inteligencia artificial, creado en Oviedo por un enfermero en activo. Genera el cuadrante mensual completo en segundos respetando el convenio: descansos mínimos entre turnos, máximo de noches, jornadas reducidas y conciliación. Ante una baja, propone 3 candidatos de tu propia plantilla en menos de un segundo; la decisión final siempre es tuya. Incluye lector PDF con IA, vacaciones y ausencias, equidad nocturna, detección de conflictos y auditoría exportable. Tarifa plana desde 29 €/mes, sin coste por trabajador y sin permanencia. Implantación en 5-7 días y garantía de devolución de 30 días. Si funciona en un hospital, funciona en cualquier sector con turnos.
```

### 1.3 Atributos

Marcar los que Google ofrezca para la categoría (varían):
- Identificación: "Propiedad de..." solo si aplica; no marcar nada que no sea cierto.
- Servicios: **Servicios en línea** / **Citas en línea** (enlazar a `/demo` o a `/#contact`).
- Accesibilidad: no aplica (sin local).
- Formas de pago: **Transferencia bancaria**, **Domiciliación bancaria**. No marcar tarjeta (no hay checkout online).
- Idiomas de atención: español, inglés (`[CONFIRMAR: alemán y francés solo si se atiende soporte en esos idiomas; la interfaz sí está en es/en/de/fr]`).

Sección "Servicios" (crear como servicios personalizados, uno por línea):
- Planificación de turnos con IA (ShiftiaCore)
- Cobertura de ausencias con IA (Gestor de Cobertura IA)
- Importación de cuadrantes desde PDF/Excel (Lector PDF con IA)
- Auditoría gratuita de cuadrante
- Implantación guiada en 5-7 días

### 1.4 Publicaciones "Desde el negocio" (3 iniciales)

Límite de Google: 1.500 caracteres por publicación. Tipo "Novedad" salvo que se indique. Cada una lleva botón.

**Post 1 — Presentación** (tipo Novedad · botón "Más información" → `https://www.shiftia.es/demo`) — 440 caracteres

```
Shiftia ya está en Google. Somos un software de planificación de turnos con IA hecho en Oviedo por un enfermero en activo. Genera el cuadrante mensual completo en segundos respetando el convenio (descansos mínimos, máximo de noches, jornadas reducidas) y, ante una baja, propone 3 candidatos de tu propia plantilla en menos de un segundo. Tarifa plana desde 29 €/mes, sin coste por trabajador y sin permanencia. Prueba la demo sin registro.
```

**Post 2 — Auditoría gratuita** (tipo Oferta o Novedad · botón "Más información" → `https://www.shiftia.es/recursos/auditoria-cuadrante`) — 319 caracteres

```
¿Cuánto tiempo pierdes cada mes haciendo el cuadrante en Excel? Sube tu planilla actual (PDF o Excel) a nuestra auditoría gratuita y recibe un diagnóstico de equidad de noches, descansos entre turnos y riesgos de cobertura. Sin registro y sin compromiso. Es la forma más rápida de ver qué está fallando en tu cuadrante.
```

**Post 3 — Contenido de /recursos** (tipo Novedad · botón "Más información" → `https://www.shiftia.es/recursos/descanso-minimo-entre-turnos`) — 298 caracteres

```
Descanso mínimo entre turnos: es una de las reglas del convenio que más se incumple sin querer cuando el cuadrante se hace a mano. Hemos publicado una guía con calculadora para comprobar si tu planilla lo respeta. Shiftia lo aplica automáticamente: el motor no genera turnos que rompan el convenio.
```

Ritmo posterior: 1 publicación cada 2-4 semanas reutilizando los posts de LinkedIn (kit 2.2). Las publicaciones caducan visualmente a los 6 meses.

### 1.5 Preguntas y respuestas (5 propias)

En Google Business Profile el propietario puede publicar preguntas y responderlas él mismo; es la forma de fijar las FAQ antes de que lo haga un tercero. Textos sacados de las FAQ reales de la web (`public/index.html`, bloque FAQPage, y `llms.txt`).

**P1.** ¿Cuánto cuesta Shiftia?
**R.** Tarifa plana sin coste por trabajador y sin permanencia. Esencial 29 €/mes (hasta 15 trabajadores), Pro 69 €/mes (hasta 40), Business 129 €/mes (hasta 100, multi-centro) y Enterprise a medida. Un 20 % de descuento si pagas anual. Garantía de devolución de 30 días.

**P2.** ¿Cómo funciona el motor de IA cuando alguien falta?
**R.** Analiza 11 criterios (carga, descansos, convenio, contrato, preferencias, polivalencia, fiabilidad, desempeño, absentismo, aceptación y frescura) y propone 3 candidatos de tu propia plantilla en menos de un segundo. La decisión final siempre es humana: se aprueba con un clic.

**P3.** ¿Cuánto tarda la implantación?
**R.** Entre 5 y 7 días laborables desde la contratación. Configuramos tu equipo, importamos la planilla que ya tienes (PDF o Excel) y te acompañamos en todo el proceso. Las plazas de implantación son limitadas cada mes.

**P4.** ¿Es una ETT o aporta personal?
**R.** No. Shiftia solo planifica la plantilla interna de tu empresa. No aporta trabajadores ni es una bolsa de profesionales externos. La cobertura de bajas se resuelve siempre entre tu propio equipo.

**P5.** ¿Cómo se contrata y dónde están los datos?
**R.** Por llamada previa: agenda una llamada desde el formulario de contacto, elegimos el plan y acordamos la forma de pago (transferencia o domiciliación SEPA). No hay checkout online. Los datos se alojan en la UE, con cumplimiento RGPD y cifrado; si cancelas, puedes exportar tus datos.

### 1.6 Fotos que subir

| Tipo | Archivo / qué mostrar | Especificación |
|---|---|---|
| Logo | Logo Shiftia sobre fondo blanco, cuadrado, sin texto pequeño (`public/icon-512.png` si tiene margen suficiente; si no, exportar versión con margen) | 720 x 720 px mín., JPG/PNG |
| Portada | Cuadrante mensual generado por ShiftiaCore, con el nombre de la marca superpuesto (se puede partir de `public/og-image.png`, recortado a 16:9) | 1.024 x 576 px mín., 16:9 |
| Captura 1 | **Planilla visual mensual** con rotaciones M/T/N de un equipo ficticio (nombres inventados, nunca de clientes reales), mostrando el detector de conflictos sin alertas | 1.200 x 900 px o superior |
| Captura 2 | **Gestor de Cobertura IA**: una ausencia y los 3 candidatos propuestos con su puntuación por criterios y el botón de aprobar | Misma resolución; anonimizar datos |
| Captura 3 | **Equidad nocturna / dashboard**: la media de noches por persona y el radar de riesgo a 14 días | Misma resolución |

Consejo: subir las capturas desde la demo (`/demo`) con datos ficticios; Google rechaza a veces imágenes con demasiado texto pequeño, así que mejor vistas limpias y con zoom.

**Nota para Diego (GBP):** rellenar `[HORARIO]` y `[AÑO/MES DE FUNDACIÓN]` (teléfono: +34 663 50 46 47). Guardar el **enlace corto de reseñas** (Perfil → "Pedir reseñas") y pegarlo en `docs/visibilidad/resenas-mensajes.md` para el paso 1.4. Confirmar los idiomas de atención antes de marcarlos.

---

## 2. Crunchbase (paso 2.3)

Alta en https://www.crunchbase.com/add-new (perfil gratuito "Organization"). Se rellena en inglés; abajo va también la versión en español para reutilizar en SoftDoit/Capterra. Crunchbase permite reclamar el perfil (`Claim profile`) con el email de dominio: usar `info@shiftia.es`.

### 2.1 Campos (versión en inglés — la que se pega en Crunchbase)

| Campo Crunchbase | Valor |
|---|---|
| Organization name | Shiftia |
| Legal name | Highkey Labs Software Solutions `[CONFIRMAR forma jurídica exacta: S.L. / S.L.U. y si figura así en el registro]` |
| Also known as | Shiftia.es |
| Short description (≤ 200 c.) | ver 2.2 |
| Full description | ver 2.3 |
| Headquarters | Oviedo, Asturias, Spain |
| Founded date | `[AÑO: confirmar; opcionalmente mes]` |
| Founders | Diego Ciborro — Founder & Director (añadir su perfil de persona: título "Founder & Director, Shiftia · Registered Nurse") |
| Company type | For profit |
| Operating status | Active |
| Industries / Categories | SaaS · Human Resources · Artificial Intelligence · Scheduling · Health Care · Enterprise Software · Productivity Tools · Employee Management |
| Industry groups | Software · Administrative Services · Artificial Intelligence · Health Care |
| Website | https://www.shiftia.es |
| LinkedIn | https://www.linkedin.com/company/shiftia |
| Contact email | info@shiftia.es |
| Phone | +34 663 50 46 47 |
| Number of employees | `[CONFIRMAR: rango 1-10 / 11-50]` |
| Business model | B2B, SaaS (subscription, flat monthly/annual pricing) |
| Markets / Geography served | Spain (primary); interface also available in English, German and French |
| Funding status | `[CONFIRMAR: Bootstrapped / no external funding — solo marcar si es cierto; si hay ronda o subvención pública, no inventar importe]` |
| Products | Shiftia — AI shift scheduling platform (ShiftiaCore, AI Coverage Engine, AI PDF Reader) |
| Logo | Mismo logo cuadrado que en GBP |

### 2.2 Short description (límite 200 caracteres)

**EN — 178 caracteres**
```
Spanish AI-powered shift scheduling SaaS. Builds full, labour-agreement-compliant rosters in seconds and suggests in-house replacements for absences. Flat pricing from €29/month.
```

**ES — 184 caracteres** (para SoftDoit/Capterra-ES)
```
Software español de planificación de turnos con IA. Genera cuadrantes completos en segundos respetando el convenio y propone sustitutos de la propia plantilla. SaaS B2B desde 29 €/mes.
```

### 2.3 Full description

**EN**
```
Shiftia is a Spanish B2B SaaS for AI-powered shift scheduling and rostering, developed by Highkey Labs Software Solutions in Oviedo (Asturias, Spain). It was founded by Diego Ciborro, a registered nurse who still works in the Spanish public health system, and it is built around one idea: if it works in a hospital, it works in any industry that runs on shifts.

The platform generates a complete monthly or yearly roster from scratch in seconds (ShiftiaCore), respecting the collective labour agreement: minimum rest between shifts, maximum number of night shifts, reduced working hours, work-life balance rules, public holidays and on-call duties. When an employee is absent, the AI coverage engine scores 11 criteria and proposes 3 candidates from the client's own staff in under one second; the final decision is always made by a human. Other features include an AI reader that imports existing rosters from PDF or Excel, holiday and absence management, night-shift fairness metrics, a conflict detector, a 14-day risk radar, dashboards and an exportable audit trail. Business plans add multi-site management, coverage maps, AI reports, payroll integration and API access; Enterprise plans offer on-premise or private-cloud deployment and custom integrations (HIS, ERP, time and attendance).

Shiftia only schedules the client's internal workforce: it is not a staffing agency or a marketplace. Pricing is a flat monthly fee from €29/month with no per-employee cost and no lock-in, with a 30-day money-back guarantee and go-live in 5-7 working days. Data is hosted in the EU under GDPR. Customers include public healthcare (a department of a public hospital in Granada), laboratories and healthcare services in Asturias, SPAR Supermercados (retail, Gran Canaria), NONWATIO (industrial refrigeration, Valencia) and La Otra Abacería (hospitality, León). The interface is available in Spanish, English, German and French.
```

**ES**
```
Shiftia es un SaaS B2B español de planificación de turnos y cuadrantes con inteligencia artificial, desarrollado por Highkey Labs Software Solutions en Oviedo (Asturias). Lo fundó Diego Ciborro, enfermero especialista en activo en la sanidad pública, y parte de una idea: si funciona en un hospital, funciona en cualquier sector con turnos.

La plataforma genera el cuadrante mensual o anual completo desde cero en segundos (ShiftiaCore) respetando el convenio: descansos mínimos entre turnos, máximo de noches, jornadas reducidas, conciliación, festivos y guardias. Ante una ausencia, el motor IA de coberturas analiza 11 criterios y propone 3 candidatos de la propia plantilla en menos de un segundo; la decisión final siempre es humana. Incluye lector PDF con IA para importar cuadrantes existentes (PDF/Excel), vacaciones y ausencias, equidad nocturna, detector de conflictos, radar de riesgo a 14 días, dashboard e historial y auditoría exportable. El plan Business añade multi-centro, mapa de cobertura, informes con IA, integración con nómina y API; Enterprise ofrece on-premise o nube privada e integraciones a medida (HIS, ERP, fichaje).

Shiftia solo planifica la plantilla interna del cliente: no es una ETT ni un marketplace de personal. Tarifa plana desde 29 €/mes, sin coste por trabajador y sin permanencia, con garantía de devolución de 30 días e implantación en 5-7 días laborables. Datos alojados en la UE con cumplimiento RGPD. Entre sus clientes están un servicio de un hospital público de Granada, laboratorios y servicios sanitarios en Asturias, SPAR Supermercados (retail, Gran Canaria), NONWATIO (frío industrial, Valencia) y La Otra Abacería (hostelería, León). Interfaz en español, inglés, alemán y francés.
```

### 2.4 Perfil de persona: Diego Ciborro

| Campo | Valor |
|---|---|
| Name | Diego Ciborro |
| Primary job title | Founder & Director |
| Primary organization | Shiftia |
| Location | Oviedo / Gijón, Asturias, Spain `[elegir una]` |
| Bio (EN) | Founder and Director of Shiftia, an AI shift scheduling platform. Registered nurse specialist working in the Spanish public health system (blood bank and blood products unit). Master's degree in Nursing Management and PhD candidate in Healthcare Quality. Has built machine learning models in healthcare, including demand forecasting for blood products. |
| LinkedIn | https://www.linkedin.com/in/diego-ciborro-4812183a2 |

**Nota para Diego (Crunchbase):** confirmar forma jurídica y nombre registral exacto, año de fundación, rango de empleados y estado de financiación (si hay subvención o préstamo público, se puede indicar "Grant" solo con importe y fecha reales; si no se quiere publicar, dejar en blanco). Crunchbase tarda 1-3 días en aprobar el perfil; después reclamarlo con `info@shiftia.es` para poder editarlo.

---

## 3. LinkedIn — página de empresa (paso 2.2, ficha)

La página ya existe (`linkedin.com/company/shiftia`). Aquí solo se optimiza la ficha; los posts van en el kit 2.2.

### 3.1 Tagline (límite 120 caracteres)

**ES — 98 caracteres** (la que se usa; la página está en español)
```
Planificación de turnos con IA. Tu equipo. Tu convenio. Tu cuadrante. Tarifa plana desde 29 €/mes.
```

**EN — 108 caracteres** (si se activa la versión en inglés de la página: Admin → Idiomas)
```
AI shift scheduling built by a working nurse. Your team. Your labour agreement. Your roster. From €29/month.
```

### 3.2 "Acerca de" (límite 2.000 caracteres)

**ES — 1.940 caracteres**
```
Shiftia es un software español de planificación completa de turnos y cuadrantes con inteligencia artificial. Lo creamos en Oviedo, y lo dirige un enfermero que sigue trabajando en la sanidad pública. Por eso el producto parte de una idea sencilla: si funciona en un hospital, funciona en cualquier sector con turnos.

Qué hace Shiftia:
- Genera el cuadrante mensual (y anual) desde cero en segundos con ShiftiaCore, respetando el convenio, la equidad nocturna y las restricciones de cada persona.
- Ante una ausencia, el motor IA de coberturas propone 3 candidatos de tu propia plantilla en menos de un segundo, analizando 11 criterios. La decisión final siempre es humana: se aprueba con un clic.
- Convenio inteligente: descansos mínimos entre turnos, máximo de noches, jornadas reducidas, conciliación, festivos y guardias. El motor no genera turnos que rompan el convenio.
- Lector de PDF y Excel con IA para importar el cuadrante que ya tienes.
- Vacaciones y ausencias, detector de conflictos, radar de riesgo a 14 días, dashboard y auditoría exportable.
- Multi-centro, mapa de cobertura, informes con IA, integración con nómina y API en el plan Business. On-premise o nube privada en Enterprise.

Lo que no somos: ni una ETT ni una bolsa de personal externo. Shiftia solo planifica la plantilla interna del cliente.

Trabajamos con organizaciones de sanidad pública, laboratorios, retail, frío industrial y hostelería, como un servicio de un hospital público de Granada, SPAR Supermercados en Gran Canaria o NONWATIO en Valencia.

Tarifa plana desde 29 €/mes, sin coste por trabajador y sin permanencia. Implantación en 5-7 días laborables y garantía de devolución de 30 días. Datos en la UE, RGPD y cifrado. Interfaz en español, inglés, alemán y francés.

Prueba la demo sin registro en shiftia.es/demo o sube tu cuadrante a nuestra auditoría gratuita en shiftia.es/recursos/auditoria-cuadrante.
```

**EN — 1.914 caracteres**
```
Shiftia is a Spanish AI-powered shift scheduling and rostering platform. We build it in Oviedo (Asturias), and it is run by a nurse who still works in the public health system. That is why the product starts from a simple idea: if it works in a hospital, it works in any industry that runs on shifts.

What Shiftia does:
- Builds the full monthly (and yearly) roster from scratch in seconds with ShiftiaCore, respecting the collective labour agreement, night-shift fairness and each person's individual constraints.
- When someone is absent, the AI coverage engine suggests 3 candidates from your own staff in under a second, scoring 11 criteria. The final decision is always human: you approve it with one click.
- Smart labour-agreement rules: minimum rest between shifts, maximum nights, reduced working hours, work-life balance, public holidays and on-call duties. The engine never generates a shift that breaks the rules.
- AI reader for PDF and Excel to import the roster you already have.
- Holidays and absences, conflict detector, 14-day risk radar, dashboard and exportable audit trail.
- Multi-site, coverage map, AI reports, payroll integration and API on the Business plan. On-premise or private cloud on Enterprise.

What we are not: a staffing agency or a marketplace for external workers. Shiftia only schedules the client's own internal staff.

We work with public healthcare organisations, laboratories, retail, industrial refrigeration and hospitality businesses, including a department of a public hospital in Granada, SPAR Supermercados in Gran Canaria and NONWATIO in Valencia.

Flat pricing from €29/month, no per-employee fees, no lock-in. Go-live in 5-7 working days and a 30-day money-back guarantee. Data hosted in the EU, GDPR-compliant and encrypted. Interface in Spanish, English, German and French.

Try the demo with no sign-up at shiftia.es/demo.
```

### 3.3 Resto de la ficha

| Campo | Valor |
|---|---|
| Sector | Desarrollo de software |
| Tipo de empresa | Empresa privada |
| Tamaño | `[CONFIRMAR: 1-10 empleados / 11-50]` |
| Sede | Oviedo, Principado de Asturias, España |
| Año de fundación | `[AÑO: confirmar]` |
| Web | https://www.shiftia.es |
| Botón CTA | **"Más información"** → `https://www.shiftia.es/demo` (alternativa: "Contactar" → `https://www.shiftia.es/#contact`). Recomendación: "Más información" a la demo, porque no requiere registro y es el activo que más convierte curiosos en contactos. |
| Hashtags de la página (máx. 3) | #turnos #cuadrantes #PlanificacionDeTurnos |
| Ubicaciones | Oviedo (sede). No añadir Gijón: el hospital no es una sede de Shiftia. |

### 3.4 Especialidades (20 términos, máximo de LinkedIn)

Pegar separadas por coma. Mezcla términos de búsqueda en español (mercado principal) con 4 en inglés para la búsqueda internacional de LinkedIn.

```
Planificación de turnos, Cuadrantes de turnos, Software de turnos, Gestión de turnos con IA, Cuadrantes de enfermería, Turnos en residencias, Turnos en hostelería, Turnos en retail, Turnos en industria, Cobertura de ausencias, Convenio colectivo y descansos, Descanso mínimo entre turnos, Equidad de turnos nocturnos, Planilla mensual y anual, Importación de cuadrantes PDF y Excel, SaaS B2B, Inteligencia artificial aplicada a RRHH, Employee scheduling, Nurse scheduling, Workforce management
```

**Nota para Diego (LinkedIn):** confirmar tamaño y año. Si se activa la versión en inglés, LinkedIn permite nombre, tagline y "Acerca de" por idioma: usar los textos EN de arriba. Subir el mismo logo cuadrado y una portada 1.128 x 191 px (recortar la portada de GBP o usar `og-image.png` con margen).

---

## 4. Product Hunt (opcional según el plan)

Ojo: el plan lo marca como opcional y con razón. Product Hunt aporta un **backlink dofollow de dominio muy fuerte** y menciones que luego citan agregadores y LLMs; no aporta clientes en España de forma directa. Lanzar solo si Diego puede dedicar un día entero a responder comentarios y tiene una red mínima de apoyo (ver checklist). Si no, dejarlo para después de la prensa (paso 2.1).

### 4.1 Ficha

| Campo | Valor | Recuento |
|---|---|---|
| Name | Shiftia | — |
| Tagline (≤ 60 c.) | `AI shift scheduling that respects your labour agreement` | 55 |
| Description (≤ 260 c.) | ver abajo | 234 |
| Website | https://www.shiftia.es (añadir `?ref=producthunt` para medir) | — |
| Topics (3) | **Productivity** · **Artificial Intelligence** · **Human Resources** (alternativa si hay hueco: SaaS, Health) | — |
| Pricing | Paid (flat pricing from €29/month; free interactive demo, no sign-up) | — |
| Links | LinkedIn de la página; demo `https://www.shiftia.es/demo` | — |
| Makers | Diego Ciborro (cuenta personal de PH, creada al menos 2 semanas antes y con algo de actividad) | — |
| First comment | ver 4.2 | 429 palabras |

**Description (234 caracteres)**
```
Shiftia builds complete, labour-agreement-compliant shift rosters in seconds and suggests 3 in-house replacements for any absence in under a second. Built in Spain by a working nurse. Flat pricing from €29/month, no per-employee fees.
```

### 4.2 Primer comentario del maker (inglés, 429 palabras)

```
Hi Product Hunt, I'm Diego, founder of Shiftia. I'm also a nurse, and I still work shifts in a public hospital in Gijón, in the north of Spain. That second part matters, because Shiftia exists to fix a problem I have lived with for years.

Every month, in every unit I have worked in, someone spends hours building the shift roster by hand. Usually in Excel, sometimes on paper. It has to respect the collective labour agreement (minimum rest between shifts, a maximum number of nights, reduced working hours, holidays), keep the night shifts fairly distributed, and account for each person's constraints. Then someone calls in sick and the whole thing starts again: phone calls, favours, and the same two people always covering.

I had already built machine learning models in the hospital (demand forecasting for blood products), so at some point the obvious question came up: why is the roster still done by hand?

Shiftia is the answer. In short:

- ShiftiaCore generates the full monthly or yearly roster from scratch in seconds, and it never produces a shift that breaks the labour agreement.
- When someone is absent, the coverage engine scores 11 criteria (workload, rest, contract, preferences, versatility, reliability, absence history and more) and suggests 3 candidates from your own team in under a second. A human approves it with one click. We do not replace the supervisor; we save them the phone calls.
- Night-shift fairness is calculated only among the people who actually rotate, so imbalances show up before they become a conflict.
- An AI reader imports the roster you already have from PDF or Excel.
- Holidays, absences, a conflict detector, a 14-day risk radar and an exportable audit trail.

A few things we decided early on. Pricing is flat, from €29/month, with no per-employee fees and no lock-in, because small teams should not be punished for growing. Data stays in the EU. And Shiftia only schedules your own staff: it is not a staffing marketplace.

It started in healthcare, but the same rules apply to a supermarket, a cold-storage warehouse or a restaurant, and today we have customers in all of those, plus a urology department in a public hospital in Granada.

The interface is available in English, Spanish, German and French. There is a demo you can try without signing up at shiftia.es/demo.

I would love your feedback, especially from anyone who has ever had to build a roster for a team that works nights. What would make this useful for you? I will be here all day answering questions.
```

### 4.3 Galería (5 imágenes a preparar, 1.270 x 760 px, PNG, interfaz en inglés)

1. **Portada**: cuadrante mensual generado, con el titular "Full roster in seconds. Labour agreement respected." y el logo.
2. **AI coverage**: pantalla del Gestor de Cobertura IA con una ausencia y los 3 candidatos puntuados; anotación "3 candidates · 11 criteria · under 1 second · human approves".
3. **Rules**: panel de convenio inteligente (descansos mínimos, máximo de noches, jornadas reducidas) con anotación "The engine never breaks your rules".
4. **Import**: Lector PDF con IA reconociendo códigos M/T/N, VAC, LIB a partir de un PDF real anonimizado; anotación "Bring the roster you already have (PDF/Excel)".
5. **Fairness & risk**: equidad nocturna + radar de riesgo 14 días; anotación "Night-shift fairness and a 14-day risk radar".

Opcional: GIF de 10-15 s de la auto-generación (ShiftiaCore) como primera imagen; PH lo reproduce en la tarjeta.

Datos siempre ficticios; nunca capturas de clientes reales.

### 4.4 Checklist de lanzamiento

- [ ] **Día**: martes, miércoles o jueves. Evitar lunes (mucha competencia) y viernes/fin de semana (poco tráfico). Evitar fechas con lanzamientos grandes anunciados.
- [ ] **Hora**: publicar a las **00:01 hora del Pacífico** (PT), que son las **09:01 en la España peninsular** tanto en verano (PDT/CEST) como en invierno (PST/CET); solo cambia en las dos semanas entre el cambio de hora europeo (último domingo de octubre) y el estadounidense (primer domingo de noviembre), en las que son las 08:01. Comprobar en el día. Es el inicio del "día" de PH y da 24 h completas.
- [ ] **Hunter**: se puede lanzar sin hunter externo (el maker publica) y hoy PH ya no da ventaja algorítmica al hunter. Si alguien conocido con historial en PH quiere "cazarlo", bien; si no, no retrasar el lanzamiento por eso. Persona: `[HUNTER o "el propio Diego"]`.
- [ ] **Cuenta del maker** creada 2+ semanas antes, con foto, bio y 5-10 upvotes/comentarios previos en otros productos (las cuentas nuevas pesan menos).
- [ ] **Página "Coming soon"** (Product Hunt → Launches → Schedule) publicada 1-2 semanas antes para recoger seguidores que reciben aviso el día del lanzamiento.
- [ ] **Red de apoyo** avisada la víspera con enlace directo (no pedir "upvote" explícito; pedir "pásate, mira y comenta si te aporta"): contactos de LinkedIn, clientes, compañeros del hospital con cuenta en PH, comunidad de startups asturiana `[LISTA DE 20-30 PERSONAS]`. Los votos de cuentas recién creadas ese día pueden ser descartados por PH.
- [ ] **Post en LinkedIn** (personal + página) a las 9:15 con enlace al lanzamiento; segundo post a las 17:00 con lo aprendido.
- [ ] **Bloque de agenda**: Diego disponible de 9:00 a 23:00 para responder cada comentario en < 30 min.
- [ ] **Web lista**: `/demo` funcionando, tiempo de carga revisado, UTM `?ref=producthunt` en todos los enlaces.
- [ ] **Después**: añadir la URL del lanzamiento al bloque `sameAs` (sección 6) y el badge de PH en la web si el resultado lo merece; responder a los comentarios pendientes durante la semana siguiente.

### 4.5 Riesgos y expectativas

- **Audiencia mayoritariamente anglófona y estadounidense**: casi nadie en PH contrata software de turnos con convenio español. El valor del lanzamiento es el **backlink**, la ficha permanente (que los LLMs y agregadores citan) y las menciones en newsletters de "lanzamientos de la semana"; no los leads.
- **Coste de oportunidad**: un día entero de Diego. Si ese día resta al pitch de prensa (paso 2.1), la prensa va primero.
- **Resultado modesto es lo normal**: sin red de apoyo, un producto B2B de nicho suele quedar en 30-100 votos. No es un fracaso; la ficha queda igualmente.
- **Reglas de PH**: no incentivar votos (sorteos, descuentos por votar) ni pedir upvotes de forma masiva; PH puede retirar el lanzamiento.
- **Coherencia**: todo lo que se afirme en PH debe coincidir con la web (precios en euros, "no staffing", clientes solo los de la ficha). Nada de "trusted by 500 companies".

**Nota para Diego (PH):** decidir si se lanza y cuándo (recomendación: después de tener al menos 1 pieza de prensa y 3 reseñas, para que el perfil de PH enlace también a ellas). Rellenar hunter y lista de apoyo.

---

## 5. Wikipedia y Wikidata

### 5.1 Wikipedia: por qué NO todavía

El criterio de notabilidad de Wikipedia para empresas (es: "Wikipedia:Relevancia" · en: "WP:NCORP") exige **cobertura significativa, independiente y fiable** de varias fuentes: artículos de fondo en medios con criterio editorial, escritos por terceros y que no sean notas de prensa reproducidas, entrevistas promocionales, directorios (Crunchbase, Capterra), ni contenido de la propia empresa. Hoy Shiftia no tiene esa cobertura, así que un artículo se borraría en días (borrado rápido por promoción o consulta de borrado por falta de relevancia) y, peor, dejaría un registro de borrado que dificulta el intento futuro y que otros editores citan como "ya se intentó".

Además, crear el artículo el propio fundador o alguien pagado es **conflicto de intereses**: hay que declararlo y, en la práctica, va por el "Taller" con revisión, no directamente al espacio principal.

**Qué cobertura haría falta antes** (orientativo, mínimo razonable):
- 3-4 piezas en medios con redacción propia sobre Shiftia o sobre Diego *por* Shiftia: reportaje o entrevista de fondo en La Nueva España, El Comercio, prensa económica (Expansión, El Economista, Cinco Días), medios sectoriales (iSanidad, Geriatricarea, Balance Sociosanitario) o tecnológicos con criterio editorial. Cuentan más si no son la misma nota de prensa reescrita.
- Al menos una fuente que no sea asturiana ni sectorial (cobertura nacional o internacional).
- Algo verificable por terceros: premio con jurado reconocido, participación documentada en un programa público, o inclusión en una comparativa independiente publicada.
- Tiempo: cobertura repartida en el tiempo, no solo el día del lanzamiento.

Cuando se den esas condiciones, el camino es: borrador en Taller, declaración de conflicto de intereses en la página de discusión, tono enciclopédico (sin "líder", sin "innovador"), y dejar que un editor independiente lo mueva. Mientras tanto, el paso 2.1 (prensa) es el trabajo previo real.

### 5.2 Wikidata: qué SÍ se puede hacer ya

Wikidata tiene un umbral mucho más bajo: basta con que la entidad sea **identificable por fuentes externas** y no exista ya. Un ítem de empresa con web oficial y sede es aceptable y sirve como **señal de entidad** que Google (Knowledge Graph) y varios LLMs consumen.

Ítem propuesto (crear en https://www.wikidata.org/wiki/Special:NewItem, con cuenta propia, no anónima):

| Propiedad | Valor |
|---|---|
| Etiqueta (es / en) | Shiftia / Shiftia |
| Descripción (es) | software español de planificación de turnos con inteligencia artificial |
| Descripción (en) | Spanish AI-based shift scheduling software company |
| Alias | Highkey Labs Software Solutions |
| instancia de (P31) | empresa (Q4830453) · empresa de software (Q1058914) |
| sitio web oficial (P856) | https://www.shiftia.es |
| sede (P159) | Oviedo (Q14317) |
| país (P17) | España (Q29) |
| fecha de fundación (P571) | `[AÑO: confirmar]` |
| fundado por (P112) | `[solo si Diego Ciborro tiene ítem propio; no crear ítem de persona sin fuentes]` |
| sector (P452) | software (Q7397) · gestión de recursos humanos `[buscar el ítem exacto]` |
| nombre oficial (P1448) | Highkey Labs Software Solutions `[CONFIRMAR forma jurídica]` |
| identificador LinkedIn de empresa (P4264) | shiftia |
| identificador Crunchbase (P2088) | `[slug cuando exista el perfil]` |
| identificador Product Hunt `[comprobar el número de propiedad en Wikidata buscando "Product Hunt ID"]` | `[slug cuando exista el lanzamiento]` |
| Referencias | cada afirmación con "URL de referencia" a la web oficial (`/sobre-nosotros`) y, cuando exista, a la nota de prensa; sin referencias, otros editores pueden retirar los datos |

**Riesgos de Wikidata:**
- **Borrado por falta de notabilidad**: si un editor considera que el ítem existe solo por promoción y no tiene referencias externas, puede proponerlo para borrado. Mitigación: referenciar todo, no rellenar propiedades que no se puedan verificar, y añadir el identificador de Crunchbase/LinkedIn (son "identificadores externos", que refuerzan la existencia).
- **Ediciones de terceros**: cualquiera puede editar; un dato erróneo (sede, año) puede quedar fijado. Mitigación: vigilar el ítem (lista de seguimiento) y corregir con referencia.
- **No crear el ítem de Diego** de momento: un ítem de persona sin fuentes independientes se borra con más facilidad y da mala imagen. Cuando haya prensa, sí.
- **Coherencia con la web**: el `@id` del Organization en `index.html` puede añadir `"sameAs"` al ítem de Wikidata (`https://www.wikidata.org/wiki/Q…`) una vez creado; es la forma de cerrar el círculo entidad ↔ web.

---

## 6. Bloque JSON-LD `sameAs` para la web

### 6.1 Dónde va

En `public/index.html` hay **dos** bloques `Organization`:
1. El principal, dentro del `@graph` (línea ~29, `"@id": "https://www.shiftia.es/#organization"`). Hoy tiene `"sameAs": ["https://www.linkedin.com/company/shiftia"]` (línea ~47).
2. Un segundo bloque `Organization` suelto más abajo (línea ~196-201), también con `sameAs` solo a LinkedIn. Es redundante: conviene que Highkey Labs lo elimine o lo deje sincronizado con el primero para no emitir dos entidades distintas.

Instrucción: **sustituir el array `sameAs` del bloque principal** (el del `@graph`) por el de abajo, y aplicar el mismo array al segundo bloque si se mantiene. Añadir solo las URLs que ya existan y estén publicadas; una URL rota o pendiente resta credibilidad al grafo.

### 6.2 Bloque listo (ir descomentando conforme existan los perfiles)

```json
"sameAs": [
  "https://www.linkedin.com/company/shiftia",
  "https://www.crunchbase.com/organization/[SLUG-CRUNCHBASE: p. ej. shiftia]",
  "https://www.producthunt.com/products/[SLUG-PH: p. ej. shiftia]",
  "https://g.co/kgs/[ID-GOOGLE-BUSINESS: enlace corto del perfil, o la URL de Google Maps del negocio]",
  "https://www.capterra.es/software/[ID]/shiftia",
  "https://www.getapp.es/software/[ID]/shiftia",
  "https://www.softwaredoit.es/[RUTA-DE-LA-FICHA-SOFTDOIT]",
  "https://www.wikidata.org/wiki/[Q-ID]",
  "https://www.youtube.com/@[CANAL: solo si existe]"
]
```

Versión mínima para pegar hoy (solo lo que ya existe), sin cambios respecto al actual:

```json
"sameAs": ["https://www.linkedin.com/company/shiftia"]
```

### 6.3 Ampliación recomendada del mismo bloque `Organization`

Mientras se toca el fichero, conviene añadir dos propiedades más al Organization principal (todo dato de la ficha):

```json
"legalName": "Highkey Labs Software Solutions",
"foundingDate": "[AÑO: confirmar, formato YYYY]",
"contactPoint": {
  "@type": "ContactPoint",
  "contactType": "sales",
  "email": "info@shiftia.es",
  "telephone": "+34 663 50 46 47",
  "availableLanguage": ["es", "en"]
}
```

Comprobar después en https://validator.schema.org y en la prueba de resultados enriquecidos de Google.

**Nota para Diego (JSON-LD):** pasar a Highkey Labs este bloque junto con las URLs definitivas cuando existan. Orden de aparición esperado: GBP y Crunchbase (esta semana), Capterra/SoftDoit (bloque 1), Wikidata (cuando esté el ítem), Product Hunt (si se lanza), YouTube (solo si hay canal con al menos un vídeo publicado).

---

## Resumen de marcadores pendientes

| Marcador | Dónde | Quién lo rellena |
|---|---|---|
| ~~`[TELÉFONO]`~~ | GBP, Crunchbase, JSON-LD | Resuelto: +34 663 50 46 47 (provisional); ya en el JSON-LD de la web |
| `[HORARIO]` | GBP | Diego |
| `[AÑO/MES DE FUNDACIÓN]` | GBP, Crunchbase, LinkedIn, Wikidata, JSON-LD | Diego (según escritura de constitución) |
| `[forma jurídica exacta]` | Crunchbase, Wikidata, JSON-LD | Diego (registro mercantil) |
| `[rango de empleados]` | Crunchbase, LinkedIn | Diego |
| `[estado de financiación]` | Crunchbase | Diego (dejar en blanco si hay dudas) |
| `[idiomas de atención]` | GBP | Diego |
| `[HUNTER]`, `[LISTA DE APOYO]` | Product Hunt | Diego, solo si se lanza |
| `[SLUGs / IDs de perfiles]` | JSON-LD, Wikidata | Se obtienen al crear cada perfil |
| `[enlace corto de reseñas de Google]` | Para el paso 1.4 | Se obtiene tras verificar el GBP |
