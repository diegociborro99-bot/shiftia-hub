# Kit de alta en directorios y reseñas — Shiftia

Desarrolla los **pasos 1.1, 1.2 y 1.3** del plan de visibilidad (SoftDoit, Capterra/GetApp/Software Advice, Perfil de Empresa en Google) y la petición de inclusión en **listicles y comparativas** (bloque GEO). Todos los textos están listos para pegar y llevan su recuento de caracteres.

**Fuentes de verdad:** `ficha-marca.md` para todo lo que se afirma de Shiftia; `research/directorios-y-listados.md` y `research/facts-verificados.md` para todo lo que se afirma de terceros (URL, categorías, requisitos, plazos).

**Convenciones**
- Todo lo que sigue sobre plataformas de terceros está **verificado el 7 de septiembre de 2026** salvo cuando aparece la marca `[NO CONFIRMADO: …]`, que indica exactamente qué comprobar y dónde.
- Dos tipos de marcador más: `[EN MAYÚSCULAS]` (por ejemplo `[AÑO DE FUNDACIÓN]`) son datos que Diego tiene que rellenar antes de enviar nada; `[CONFIRMAR: …]` son decisiones o comprobaciones internas pendientes. Ninguna ficha se envía con un marcador sin resolver.
- Los perfiles de entidad (Google Business Profile, Crunchbase, LinkedIn, Product Hunt, Wikidata) están desarrollados en **`docs/visibilidad/perfiles-entidad.md`**; aquí no se duplican textos, se enlazan.
- Los mensajes para pedir reseñas a clientes (paso 1.4) están en **`docs/visibilidad/resenas-mensajes.md`**.

---

## 1. Estado actual: dónde aparece Shiftia y dónde no

Comprobado el 07/09/2026 (lectura directa de los directorios + búsquedas `site:`).

| Plataforma | ¿Hay ficha de Shiftia? | Cómo se comprobó |
|---|---|---|
| SoftDoit — *Gestión de Turnos* (53 fabricantes) | **No** | Lectura directa del directorio de proveedores |
| SoftDoit — *Control Horario* (131 fabricantes) | **No** | Lectura directa |
| SoftDoit — *Residencias Geriátricas* (8 fabricantes) | **No** | Lectura directa. Categoría muy poco poblada: oportunidad |
| Capterra.es — *Software para turnos de trabajo* (~250 productos) | **No** | Lectura de la categoría + búsqueda `site:capterra.es` |
| Capterra.com — *Employee Scheduling* (602 productos) y *Nurse Scheduling* (79) | **Sin ficha localizada** `[NO CONFIRMADO: la URL directa devuelve 403 a peticiones automatizadas, así que la ausencia se deduce de búsquedas web. Comprobarlo abriendo capterra.com y buscando "Shiftia" en un navegador normal]` | Búsquedas web; URL directa 403 para bots |
| GetApp.es — *Software para turnos de trabajo* | **No** | Lectura de la categoría |
| G2 | **Sin ficha localizada** `[NO CONFIRMADO: 403 a bots. Comprobar a mano en g2.com]` | Búsquedas web; `g2.com/products/shiftia` 403 |
| ComparaSoftware — *Programación de Empleados* | **No** | Lectura de la categoría |
| Appvizer | **No** | Búsquedas web |
| Crunchbase | **Sin ficha localizada** (las búsquedas solo devuelven homónimos: Shiftah, Shifti, Shiftie, Siftia) `[NO CONFIRMADO: 403 a bots. Comprobar a mano en crunchbase.com]` | Búsqueda `site:crunchbase.com`; URL directa 403 |
| Product Hunt | **Sin ficha localizada** `[NO CONFIRMADO: 403 a bots. Comprobar a mano en producthunt.com]` | Búsqueda; URL directa 403 |
| Trustpilot | **Sin ficha localizada** `[NO CONFIRMADO: 403 a bots. Comprobar a mano en trustpilot.com]` | Búsqueda; URL directa 403 |
| Google Business Profile | **No** | "Shiftia Oviedo" en Google no devuelve nada de la marca |
| Wikidata | **No** (0 resultados) | API `wbsearchentities` |
| 16 listicles y comparativas ES 2025-2026 (§5) | **No aparece en ninguno** | Lectura directa del HTML de los 16 |

**Dónde sí aparece hoy (activos externos existentes)**
- `linkedin.com/company/shiftia` — página de empresa, nombre "ShiftIA", 4 seguidores, sede "Langreo, Asturias". Optimización en `perfiles-entidad.md` §3.
- `highkeylabs.es` — la desarrolladora la presenta como su SaaS.
- Google solo devuelve páginas propias (home y `/recursos/descanso-minimo-entre-turnos`) para consultas de marca.

**Conflictos de nombre a tener en cuenta al dar de alta:** el handle `@shiftia` en X pertenece a "Shift I.A." (agencia web ajena) y `@shiftia` en YouTube parece ocupado; en Facebook hay un perfil personal homónimo. Al rellenar campos de redes sociales en los directorios, **no enlazar ninguno de esos perfiles**: solo LinkedIn y la web.

**Conclusión:** se parte de cero en toda la capa de terceros. Es exactamente la capa que más pesa para aparecer en respuestas de IA (hasta el 89 % de las menciones de marca en respuestas de IA proceden de páginas de terceros, Ahrefs jul-2026) y para las consultas tipo "alternativas a aTurnos", donde Capterra es el resultado nº 1.

---

## 2. Alta por plataforma

### 2.0 Antes de empezar: material común a todas las altas

Prepararlo una vez y reutilizarlo. Sin esto, la mitad de los formularios se quedan a medias.

| Elemento | Especificación | Estado |
|---|---|---|
| Email corporativo | `info@shiftia.es` (o `[EMAIL PERSONAL @shiftia.es]`). Varias plataformas rechazan Gmail/Outlook | `[CONFIRMAR que se reciben correos]` |
| Teléfono | +34 663 50 46 47 (provisional) — obligatorio en SoftDoit y GBP | Listo |
| Entidad legal | Highkey Labs Software Solutions, NIF 32894332P (según `shiftia.es/privacidad`) | `[CONFIRMAR forma jurídica y nombre registral exacto]` |
| Dirección | Oviedo (Asturias) | `[CONFIRMAR dirección postal completa]` |
| Logo | PNG cuadrado con fondo transparente. Referencia secundaria: 300×300 px `[NO CONFIRMADO: el tamaño exacto no consta en las guidelines oficiales de G2 Digital Markets; subir 512×512 y dejar que la plataforma reescale]` | `public/icon-512.png` |
| 5 capturas | Ver §2.2.7 (mismas 5 para todos los directorios) | Pendiente |
| Vídeo (opcional) | 1-2 min en YouTube, **grabado en inglés** para Capterra (regla verificada) | Opcional |
| Descripciones | §3 de este documento (ES/EN, 3 longitudes) | Listas |

---

### 2.1 SoftDoit (paso 1.1)

**Lo que cambia respecto al plan:** el plan dice "ficha básica gratuita en 20 minutos con extranet". La realidad verificada es **formulario de 9 campos (3 minutos) + llamada comercial**. No hay extranet self-service pública ni campo de descripción en el alta.

**URL de alta (VERIFICADA)**
- Página de captación: `https://www.softwaredoit.es/registra-solucion-de-software/index.html`
- Formulario real (al que llevan los botones "Regístrate en SoftDoit" / "Alta de nuevas soluciones"): `https://befocusy.notion.site/34a1b8f9be92801998f3e814e92ab40e`

**Requisitos y tiempos**
- Requisito explícito del formulario: *"solo trabajamos con soluciones que ofrezcan productos o servicios tecnológicos en España"*. Shiftia cumple.
- Tras enviar: *"te llamaremos o agendaremos una reunión"*. No hay publicación automática.
- Tres modalidades anunciadas: **ficha básica (gratuita)**, ficha premium (de pago) y servicio PPC. `[NO CONFIRMADO: los precios de premium y PPC no se publican — se negocian en la llamada; pedirlos por escrito antes de comprometerse]`
- Aviso importante y verificado: el comparador guiado y el consultor de SoftDoit **solo recomiendan fichas premium**. La ficha gratuita da presencia en el directorio y una URL indexable, pero previsiblemente **no entra en el listicle "12 mejores software Gestión de Turnos"**. Decidir de antemano la postura sobre el pago.
- Tiempo: **5 min** el formulario + **30-45 min** de llamada.

**Campos del formulario (9, literales) y texto listo para pegar**

| Campo (literal) | Qué pegar |
|---|---|
| Empresa* — "¿Cómo se llama la empresa o solución?" | `Shiftia` |
| Nombre del contacto principal* | `Diego Ciborro [APELLIDO(S) COMPLETOS]` |
| Email* — "Email profesional (de la empresa)" | `info@shiftia.es` |
| Teléfono* | +34 663 50 46 47 |
| Web de la empresa* | `https://www.shiftia.es` |
| País de la empresa* | `España` |
| Tipo de empresa* (selector) | Elegir la opción de fabricante/desarrollador de software. `[NO CONFIRMADO: las opciones exactas del selector no se pudieron leer; si aparece "Fabricante de software" o similar, esa es la correcta — no marcar "Implementador/Partner"]` |
| Servicios (opcional) | Texto de abajo (461 caracteres) |
| Aviso legal* (checkbox) | Marcar tras leer `https://www.softwaredoit.es/aviso-legal/index.html` |

**Campo "Servicios" — 461 caracteres**

```
Software SaaS de planificación de turnos y cuadrantes con IA para empresas con plantilla propia: generación automática del cuadrante mensual y anual con reglas de convenio, cobertura de ausencias con IA entre la propia plantilla, equidad nocturna, vacaciones y ausencias, lector de cuadrantes en PDF y Excel, e informes y auditoría. Tarifa plana desde 29 €/mes sin coste por trabajador. Sectores: sanidad, residencias, industria, retail, hostelería y seguridad.
```

**Categorías a pedir en la llamada (nombre literal + URL del directorio, todas verificadas)**

| Categoría (nombre literal en SoftDoit) | URL | Por qué |
|---|---|---|
| **Gestión de Turnos** | `https://www.softwaredoit.es/software-de-gestion-de-turnos/directorio-proveedores.html` | Categoría principal. 53 fabricantes; están aTurnos, Bizneo, Sesame, Skello, Kronjop, Plain |
| **Residencias Geriátricas** | `https://www.softwaredoit.es/software-para-residencias-geriatricas/directorio-proveedores.html` | Solo 8 fabricantes y **ninguno de turnos**: es el hueco más claro |
| **Hospitales** | `https://www.softwaredoit.es/software-para-hospitales/directorio-proveedores.html` | Encaja con el origen sanitario |
| **Clínicas** | `https://www.softwaredoit.es/software-para-clinicas/directorio-proveedores.html` | Idem |
| **Vacaciones** | `https://www.softwaredoit.es/software-de-vacaciones/directorio-proveedores.html` | Shiftia gestiona vacaciones y ausencias |
| *Control Horario* | `https://www.softwaredoit.es/software-de-control-horario/directorio-proveedores.html` | **No pedirla.** Shiftia no tiene fichaje propio; entrar ahí genera expectativas falsas |

**Descripción de ficha (para la extranet, después de la llamada):** usar la de **≤1.000 caracteres en ES** de §3. `[NO CONFIRMADO: los límites de caracteres de la ficha de SoftDoit no son públicos — pedirlos en la llamada y recortar desde la versión de 1.000 hacia la de 300]`

**Guion de 60 segundos para la llamada comercial**

> Shiftia es un software español de planificación de turnos con IA, hecho en Oviedo. Lo dirijo yo, que soy enfermero en activo en la sanidad pública. Genera el cuadrante mensual completo en segundos respetando el convenio —descansos mínimos, máximo de noches, jornadas reducidas, conciliación— y, cuando alguien falta, propone tres candidatos de la propia plantilla en menos de un segundo analizando once criterios; la decisión final siempre la toma una persona. Tarifa plana: 29, 69 o 129 euros al mes según el tamaño del equipo, sin coste por trabajador y sin permanencia. Implantación en 5-7 días laborables. Clientes en sanidad pública (Servicio de Urología del Hospital Universitario Clínico San Cecilio de Granada), servicios sanitarios en Asturias, retail (SPAR), frío industrial (NONWATIO) y hostelería (La Otra Abacería). No somos una ETT ni una bolsa de personal: solo planificamos la plantilla interna del cliente.

Preguntas que hay que hacerles: precio de premium y de PPC por escrito, si la ficha básica aparece en el comparador guiado, en cuántas categorías se puede estar y cuándo se publica.

**Contacto directo si el formulario falla:** `hola@softdoit.com` · `atencionalcliente@softdoit.com` · `911 98 20 00` (SoftDoit S.L., CIF B65541948, Calle Aribau 203, 1º 2ª, 08021 Barcelona).

> Ojo con el buzón: el email de atención que figura en el aviso legal es **`atencionalcliente@softdoit.com`**, con "al". La dirección `atencioncliente@softdoit.com` (sin "al") aparece únicamente para ejercer derechos RGPD: no usarla para el alta ni para el outreach.

---

### 2.2 Capterra + GetApp + Software Advice = **G2 Digital Markets** (paso 1.2)

**Lo que cambia respecto al plan:** la URL del plan (`capterra.com/vendors/sign-up`) **da 404**. Desde el anuncio del 29/01/2026, G2 adquirió Capterra, Software Advice y GetApp a Gartner: ahora operan como **G2 Digital Markets**. Un solo alta sigue cubriendo las tres plataformas.

**URL de alta (VERIFICADA):** `https://app.g2digitalmarkets.com/get-listed/start`
(enlazada desde `https://www.capterra.com/vendors/` como "Create a product listing". Portal de vendor posterior: `https://app.g2digitalmarkets.com`)

#### 2.2.1 Requisitos verificados (Listing Guidelines oficiales)

Fuente: `https://www.g2digitalmarkets.com/listing-guidelines` (espejos legibles: `capterra.co.uk/legal/listing-guidelines`, `capterra.ca/legal/listing-guidelines`).

- **Elegibilidad:** producto B2B o B2C empaquetado (no software a medida), **públicamente disponible y con una llamada a la acción que muestre una oferta a la venta**. No se listan marketplaces ni bases de datos. Shiftia cumple: producto empaquetado, precios públicos y CTA de demo/contacto. *(Atención a la coherencia: Shiftia no tiene checkout online; la CTA pública es la demo y el formulario de contacto — es suficiente según la letra de la guía, pero es el punto que un revisor podría cuestionar.)*
- **Nombre:** debe figurar tal cual aparece en la web del proveedor, sin sufijos societarios. → `Shiftia` (nunca "Shiftia by Highkey Labs" ni "ShiftIA").
- **Descripción:** debe ser **única** (no copiada de la propia web), **sin primera persona** ("nosotros", "nuestro"), **sin superlativos ni comparativos** ("mejor", "el más rápido", "líder"), **sin teléfono, email ni URL**, sin mayúsculas excesivas, **sin saltos de línea ni HTML**. El equipo editorial puede reescribirla.
- **Capturas:** deben mostrar **la interfaz real** del software. Prohibidas las imágenes de stock y la jerga de marketing dentro de la captura.
- **Vídeo:** **grabado en inglés**, alojado en **YouTube, Vimeo o Wistia**. "Se recomienda encarecidamente al menos una captura o un vídeo".

`[NO CONFIRMADO: los límites de caracteres, el tamaño exacto del logo, el número máximo de categorías y el plazo de revisión NO constan en las guidelines oficiales. Fuentes secundarias (wheretosubmit.org, act. 04/09/2026) hablan de email de dominio corporativo obligatorio, descripción larga de 500-1.000 caracteres, logo 300×300 PNG, 4-6 capturas 1920×1080 y aprobación en 1-3 días laborables. Comprobarlo en el propio formulario: los textos de §3 y §2.2.4 están dimensionados para caber en el caso más restrictivo.]`

#### 2.2.2 Categorías exactas (verificadas)

**Principal — Capterra.com (EN):** *Employee Scheduling Software* → `https://www.capterra.com/employee-scheduling-software/` (602 productos)
**Principal — Capterra.es (ES):** *Software para turnos de trabajo* → `https://www.capterra.es/directory/30756/employee-scheduling/software`
**Principal — GetApp.es (ES):** *Software para turnos de trabajo* → `https://www.getapp.es/directory/583/employee-scheduling/software`

**Secundarias recomendadas**

| Categoría | URL | Nota |
|---|---|---|
| *Nurse Scheduling Software* (EN) | `https://www.capterra.com/nurse-scheduling-software/` | 79 productos y **ningún español**. Es el hueco más valioso |
| *Workforce Management Software* (EN) | `https://www.capterra.com/workforce-management-software/` | Encaja con multi-centro y mapa de cobertura |
| *Gestión de vacaciones y permisos* (ES) | `https://www.capterra.es/directory/31400/…` | Shiftia gestiona vacaciones y ausencias |
| *Herramientas de planificación* (ES) | `https://www.capterra.es/directory/30087/…` | Complementaria |
| *Control horario* (ES, id 30001) y *Seguimiento de la asistencia* (ES, id 30527) | — | **No marcarlas.** Shiftia no tiene fichaje ni registro horario propio |

Ojo: `capterra.com/medical-staff-scheduling-software/` **no existe** (404) y la URL `capterra.es/directory/30002/…` que aparecía en borradores previos corresponde a *Gestión de proyectos*, no a turnos.

#### 2.2.3 Campos de la ficha y qué poner en cada uno

`[NO CONFIRMADO: el formulario es una SPA que no se pudo leer sin JavaScript, así que la lista de campos es la habitual de una ficha de Capterra/GetApp; puede variar. Si aparece un campo no previsto aquí, no improvisar: contrastarlo con ficha-marca.md.]`

| Campo | Valor |
|---|---|
| Product name | `Shiftia` |
| Vendor / Company name | `Highkey Labs Software Solutions` `[CONFIRMAR forma jurídica]` |
| Website | `https://www.shiftia.es` |
| Founded / Year | `[AÑO DE FUNDACIÓN]` |
| Headquarters | Oviedo, Asturias, España |
| Company size | `[CONFIRMAR: 1-10 / 11-50]` |
| Tagline / One-liner | ver §2.2.4 |
| Short description | ver §2.2.4 |
| Long description (ES) | ver §2.2.4 |
| Long description (EN, para capterra.com) | ver §2.2.4 |
| Categories | §2.2.2 |
| Features / checklist | §2.2.5 |
| Industries served | §2.2.6 |
| Company size served | §2.2.6 |
| Pricing | §2.2.6 |
| Free trial / Free version | **No** en ambos (ver §2.2.6) |
| Languages | Spanish, English, German, French |
| Deployment / Platforms | Cloud, SaaS, Web-based (+ On-premise solo Enterprise) |
| Devices | Desktop, tablet y móvil vía navegador. **No marcar iOS ni Android nativos** |
| Support | Email, chat/soporte prioritario, SLA (Business), 24/7 opcional (Enterprise) |
| Training / Implementation | Onboarding guiado, implantación en 5-7 días laborables, documentación |
| Screenshots | §2.2.7 |
| Video | §2.2.7 |

#### 2.2.4 Textos listos para pegar

**Tagline / one-liner ES — 69 caracteres** (sin primera persona ni superlativos)
```
Planificación de turnos con IA: tu equipo, tu convenio, tu cuadrante.
```

**Tagline / one-liner EN — 67 caracteres**
```
AI shift scheduling that respects your collective labour agreement.
```

**Short description ES — 184 caracteres** (misma que en `perfiles-entidad.md` §2.2, para mantener la entidad coherente entre directorios)
```
Software español de planificación de turnos con IA. Genera cuadrantes completos en segundos respetando el convenio y propone sustitutos de la propia plantilla. SaaS B2B desde 29 €/mes.
```

**Short description EN — 178 caracteres**
```
Spanish AI-powered shift scheduling SaaS. Builds full, labour-agreement-compliant rosters in seconds and suggests in-house replacements for absences. Flat pricing from €29/month.
```

**Long description ES — 996 caracteres** (tercera persona, sin URL, sin superlativos, un solo párrafo sin saltos de línea: cumple las guidelines)
```
Shiftia es una plataforma SaaS española de planificación de turnos y cuadrantes con inteligencia artificial para empresas con plantilla propia. El motor ShiftiaCore construye el cuadrante mensual o anual completo en segundos aplicando las reglas del convenio: descansos mínimos entre turnos, máximo de noches, jornadas reducidas, conciliación, festivos, guardias y restricciones individuales. Ante una ausencia, el motor de coberturas puntúa 11 criterios y propone 3 candidatos de la propia plantilla en menos de un segundo, y el responsable aprueba la sustitución con un clic. Incluye lector de PDF y Excel con IA, vacaciones y ausencias, métricas de equidad nocturna, detector de conflictos, radar de riesgo a 14 días e historial de auditoría exportable. Los planes superiores añaden multi-centro, mapa de cobertura, informes con IA, integración con nómina y acceso API. Está creada por un enfermero en activo de la sanidad pública y sus clientes son de sanidad, industria, retail y hostelería.
```

> **Por qué no dice "residencias":** `ficha-marca.md` es explícita en que **no hay ninguna residencia entre los clientes nombrados**. Shiftia se dirige al sector sociosanitario y la página de residencias existe, pero afirmar "se usa en residencias" sería atribuirse un cliente que no hay. Los sectores que sí pueden enumerarse como uso real son los de los cinco clientes de la ficha: sanidad, industria (frío industrial), retail y hostelería.

**Long description EN — 994 caracteres** (para capterra.com; mismas reglas)
```
Shiftia is a Spanish SaaS platform for AI shift scheduling and rostering, aimed at organisations that plan their own internal workforce. The ShiftiaCore engine builds a complete monthly or yearly roster in seconds, applying collective labour agreement rules: minimum rest between shifts, maximum night shifts, reduced working hours, work-life balance, public holidays and on-call duties. When an employee is absent, the coverage engine scores 11 criteria and proposes 3 candidates from the company's own staff in under one second, and a manager approves the replacement with one click. The platform also provides an AI reader that imports existing rosters from PDF or Excel, holiday and absence management, night-shift fairness metrics, a conflict detector, a 14-day risk radar, dashboards and an exportable audit trail. Higher plans add multi-site management, coverage maps, AI reports, payroll integration and API access. It was created by a nurse working in the Spanish public health system.
```

> Por qué estas descripciones no son las mismas que las de §3: las guidelines exigen texto **único** por ficha y prohíben primera persona, URL y superlativos. Las de §3 sirven para el resto de directorios; estas dos, solo para G2 Digital Markets.

#### 2.2.5 Checklist de funcionalidades: qué marcar y qué NO

`[NO CONFIRMADO: los nombres exactos de los checkboxes de funcionalidades de la categoría no se pudieron leer (formulario con JavaScript). La tabla siguiente es la equivalencia entre las funciones reales de Shiftia y las etiquetas habituales de la categoría Employee Scheduling; comprobar el rótulo literal en el formulario y aplicar el criterio, no la etiqueta.]`

**Criterio de marcado, innegociable:** solo se marca lo que está en `ficha-marca.md`. Si una funcionalidad del listado no aparece allí, se deja sin marcar aunque "casi" la tengamos.

**SÍ marcar** (equivalencias con función explícita en `ficha-marca.md`): Automated Scheduling / Programación automática (ShiftiaCore) · Shift Scheduling · Employee Scheduling · Calendar Management (planilla mensual y anual) · Alerts/Notifications (detector de conflictos, radar de riesgo a 14 días) · Reporting & Statistics / Dashboard (dashboard y KPIs) · Audit Trail / Historial de auditoría · Leave / Time Off Management (vacaciones y ausencias) · Employee Database / Equipo, roles y perfiles · Access Controls / Permissions (roles avanzados en Business) · Multi-Location (multi-centro, Business) · Data Import/Export (lector PDF/Excel, exportación CSV/PDF) · Compliance Management entendido como **reglas de convenio configurables** · API (Business) · Multi-language (es, en, de, fr) · Mobile Access **solo si la etiqueta admite acceso web responsive**.

**Marcar solo si producto lo confirma** (son plausibles, pero la ficha de marca no los nombra como función, así que no se marcan "por si acaso"): *Schedule Distribution* (no consta un módulo de reparto o publicación del cuadrante a los empleados) · *Real-Time Updates* (no consta que la ficha hable de tiempo real) · *Skills Tracking* (la polivalencia es uno de los once criterios del motor de coberturas, no un módulo de gestión de competencias). `[CONFIRMAR con producto antes de marcar]`

**NO marcar nunca** (no consta en la ficha de marca):
- Time Clock / Time & Attendance / Fichaje / Registro horario / Punch clock
- Biometric, GPS tracking, kioskos o terminales
- Payroll Management / Gestión de nóminas → Shiftia **se integra** con nómina en Business, pero no la gestiona. Si existe la etiqueta "Payroll integration" y solo esa, se puede marcar; "Payroll management", no.
- Native mobile app / iOS app / Android app → es una web app responsive
- Applicant Tracking, Onboarding de empleados, Performance Reviews, Formación, Gastos
- Staffing / Marketplace / Bolsa de trabajo / Temp staffing → Shiftia no es una ETT
- Budgeting / Labor Cost Forecasting / Previsión de ventas
- Facturación, CRM, gestión de clientes o citas de pacientes

**Duda razonable:** si el formulario ofrece "Shift Swapping" (intercambio de turnos entre empleados), marcarlo solo si en el producto existe hoy el flujo de cambio de turno; `ficha-marca.md` habla de "cambios" en el día a día pero no de un módulo de intercambio entre empleados. `[CONFIRMAR con producto antes de marcar]`

#### 2.2.6 Sectores, tamaño, precios y demás campos estructurados

**Industries served (marcar):** Healthcare / Hospitals · Nursing & Residential Care (residencias y sociosanitario) · Medical Practice / Clinics · Laboratories · Retail · Manufacturing / Industrial · Food & Beverage / Hospitality (hostelería) · Security & Investigations · Facilities Services. **No marcar** sectores sin encaje real (Educación, Transporte, Call center, Construcción) aunque el software pudiera servir: la ficha se juzga por coherencia con los clientes reales.

> Matiz obligatorio: este campo declara **sectores a los que se dirige el producto**, no clientes conseguidos. Si el formulario lo plantea como "sectores en los que ya tienes clientes", entonces **no marcar Nursing & Residential Care**: no hay ninguna residencia entre los clientes de `ficha-marca.md`. Lo mismo vale para Security & Investigations y Facilities Services.

**Company size served:** 1-10 · 11-50 · 51-200 · 201-500 (solo vía Enterprise). El tramo natural es **10-100 trabajadores** —deducido de los tramos de los planes, no es una cifra que Shiftia declare—; por encima de 100, Enterprise a medida.

**Precios (todos reales; sin IVA, tarifa plana, sin coste por trabajador)**

| Campo | Valor |
|---|---|
| Starting price | `29 €` |
| Pricing model | **Flat rate** (tarifa plana por tramo). No "per user/per employee" |
| Billing | Mensual o anual (anual con 20 % de descuento) |
| Esencial | 29 €/mes (23 €/mes anual) — hasta 15 trabajadores |
| Pro | 69 €/mes (55 €/mes anual) — hasta 40 trabajadores |
| Business | 129 €/mes (103 €/mes anual) — hasta 100 trabajadores, multi-centro |
| Enterprise | A medida — más de 100 trabajadores, varios centros |
| **Free trial** | **No.** Hay **demo interactiva sin registro y sin tarjeta** en `/demo`; si el formulario permite matizarlo, escribir: "Demo interactiva sin registro ni tarjeta; sin versión de prueba del producto" |
| **Free version** | **No** |
| Otros | Sin permanencia · Garantía de devolución de 30 días · Contratación por llamada previa, pago por transferencia o domiciliación SEPA (no hay checkout online) |

**Idiomas del producto:** español, inglés, alemán, francés (interfaz). *Idiomas de atención:* `[CONFIRMAR: marcar solo aquellos en los que realmente se da soporte]`.

**Plataformas / despliegue:** Cloud · SaaS · Web-based. Navegador en escritorio, tablet y móvil. **On-premise / nube privada solo en Enterprise** (marcarlo únicamente si el formulario permite matizar que depende del plan). Datos alojados en la UE, RGPD, cifrado.

**Soporte:** email en todos los planes; soporte prioritario desde Pro; SLA en Business; 24/7 opcional en Enterprise. Respuesta a contactos en 24 h.

**Implantación / formación:** implantación en **5-7 días laborables** con onboarding guiado (Pro), onboarding dedicado (Business) y formación on-site (Enterprise). Documentación en `/docs`. Plazas de implantación limitadas cada mes.

#### 2.2.7 Capturas y vídeo

Cinco capturas, mismas para todos los directorios. Regla verificada: **interfaz real, sin imágenes de stock ni jerga de marketing dentro de la imagen**. Datos ficticios siempre: nombres inventados, nunca de clientes reales ni de pacientes. Tamaño de referencia 1920×1080 px `[NO CONFIRMADO: resolución de fuente secundaria]`.

| # | Captura | Qué debe verse |
|---|---|---|
| 1 | **Cuadrante mensual** | La planilla visual mensual completa de un equipo de ~20 personas con rotaciones M/T/N y códigos de turno; mes entero visible con cabecera de días y fines de semana diferenciados; sin alertas activas. Es la imagen que explica el producto en dos segundos: debe ser la primera |
| 2 | **Motor de coberturas con 3 candidatos** | Una ausencia marcada en el cuadrante y el panel del Gestor de Cobertura IA con **los 3 candidatos propuestos**, su puntuación y los criterios que la justifican (carga, descansos, convenio, preferencias, polivalencia…), más el botón de aprobar. Debe leerse que la decisión final la toma una persona |
| 3 | **Panel de equidad nocturna** | El reparto de noches por persona con la media calculada **solo entre quien rota** y las desviaciones señaladas; si cabe, el radar de riesgo a 14 días en la misma vista |
| 4 | **Alerta de conflicto** | El detector de conflictos avisando de una infracción concreta y explicada (por ejemplo, descanso entre turnos por debajo del mínimo o exceso de noches), con la regla de convenio que se incumple y la sugerencia de corrección |
| 5 | **Lector PDF con IA** | La importación de un cuadrante existente: el PDF/Excel original a un lado y a otro los turnos ya reconocidos con los códigos M/T/N, CMP, VAC, PRL, LIB, CHG mapeados. Es la captura que responde a "¿tengo que empezar de cero?" |

**Vídeo (opcional):** 1-2 min, **en inglés**, alojado en YouTube (público, no oculto), mostrando la generación del cuadrante con ShiftiaCore de principio a fin. Alternativa barata: un GIF de 20-30 s de la auto-generación para LinkedIn y Product Hunt (Product Hunt admite GIF en la miniatura y la galería). Si no hay vídeo, subir las 5 capturas: al menos una imagen es requisito recomendado explícitamente.

#### 2.2.8 Después del alta

1. Guardar la **URL del perfil** en Capterra, GetApp y Software Advice: hacen falta para `resenas-mensajes.md` (paso 1.4) y para el bloque `sameAs` de `perfiles-entidad.md` §6.
2. Activar el **Reviews Collection Program** desde el portal de vendor y usar **siempre su enlace de recopilación**. Reglas verificadas: el incentivo debe ofrecerse por igual a todos con independencia de la nota, no puede superar el valor nominal, hay que declarar en toda comunicación que **no está condicionado a una reseña positiva** y enlazar las Community Guidelines. Excluidos: empleados propios y de competidores, empleados públicos y quien tenga prohibido aceptar regalos por política interna. *(Esto último afecta al cliente del Hospital de Granada: es sanidad pública → **no ofrecerle ningún incentivo**, solo pedir la reseña.)*
3. Una ficha sin reseñas queda al final de la categoría con tráfico casi nulo `[fuente secundaria]`: el alta no sirve de nada sin el paso 1.4.

---

### 2.3 Google Business Profile (paso 1.3)

Desarrollado en **§4** de este documento (categorías, elegibilidad, verificación) y en **`docs/visibilidad/perfiles-entidad.md` §1** (todos los textos: descripción de 750, servicios, publicaciones, Q&A y fotos).

---

### 2.4 G2.com (perfil propio, distinto del alta de G2 Digital Markets)

- **URL de alta (verificada):** `https://sell.g2.com/create-a-profile` — "you can claim your profile for free".
- **Plazos (verificados):** aprobación condicional en **3-5 días laborables** y revisión final en **1-3 días laborables**.
- **Categoría:** *Employee Scheduling Software*.
- **Restricción 2026:** los perfiles gratuitos ya no llevan botón de CTA ni enlace directo a la web del proveedor `[NO CONFIRMADO: dato tomado de un snippet de company.g2.com; comprobar al crear el perfil]`.
- **Por qué merece la pena igualmente:** G2 es el 4.º dominio más citado por ChatGPT (Profound, 680 M de citas). Aunque el perfil gratuito no dé enlace, da existencia de entidad y reseñas.
- **Textos:** short y long description **EN** de §3. Aplicar las mismas cautelas de estilo que en Capterra.
- Tiempo: **20 min**.

### 2.5 ComparaSoftware España

- **URL de alta (verificada):** `https://www.comparasoftware.es/registro` — primer paso: "¿Eres fabricante de software o implementador?" → elegir **"Tengo un producto de software… para recibir cotizaciones, reseñas y aparecer en los rankings"**.
- **Categoría objetivo (verificada):** *Software para Programación de Empleados en España* → `https://www.comparasoftware.es/programacion-de-empleados` (20+ productos, mayoría anglosajones: When I Work, TSheets, Zip Schedules…). Categorías relacionadas: `/gestion-de-recursos-humanos`, `/gestion-del-tiempo`.
- Registro gratuito; `[NO CONFIRMADO: los precios de sus planes de pago no se publican]`.
- **Oportunidad concreta:** la categoría está copada por producto anglosajón sin encaje con el convenio español. Una ficha en español con precios en euros destaca sola.
- **Textos:** ES de §3. **Contacto:** `contacto@comparasoftware.com`.
- Tiempo: **20 min**.

### 2.6 Appvizer

- **URL de alta (verificada):** `https://www.appvizer.fr/partenaires/inscription` (formulario europeo único; la ficha se publica también en appvizer.es).
- **Verificado en su centro de ayuda:** "Referencing your software on Appvizer is completely free and without commitment"; validación **en 24 horas**; exigen **contenido original** (no duplicar la propia web) e indicar también las **limitaciones** del producto.
- Esa exigencia de "decir las limitaciones" encaja con el tono de la marca: declarar sin rodeos que **no hay fichaje propio, ni nómina, ni app nativa**, y que la contratación es por llamada.
- **Textos:** ES de §3 (versión de 1.000) + la nota de limitaciones.
- **Segundo objetivo:** pedir inclusión en su artículo "Los 7 mejores programas para hacer turnos rotativos" (§5, fila 9) — es de los pocos comparadores neutrales.
- Tiempo: **20 min**.

### 2.7 Otras plataformas confirmadas en la investigación

| Plataforma | URL | Estado | Prioridad |
|---|---|---|---|
| **TrustRadius** | `https://solutions.trustradius.com/claim-your-profile/` ("Claim My Free Profile"; portal `vendor.trustradius.com`) | Perfil básico gratuito verificado | Media — 15 min |
| **Crunchbase** | Alta y textos completos en `perfiles-entidad.md` §2 | Perfil gratuito; verificación con email de dominio propio | Alta (señal de entidad) |
| **Product Hunt** | Ficha completa en `perfiles-entidad.md` §4 (tagline ≤60 y descripción ≤500 verificados) | Opcional, en inglés | Baja |
| **Wikidata** | `perfiles-entidad.md` §5.2 | Sin ítem hoy; resuelve la desambiguación con "Shift I.A." | Media |
| **SaaSworthy** | `https://www.saasworthy.com/offerings` | `[NO CONFIRMADO: la página bloqueó la lectura (403); el listado gratuito para SaaS es un dato de snippet, no oficial — comprobarlo antes de invertir tiempo]` | Baja |
| **OMR Reviews** (DACH) | `https://omr.com/de/reviews` | Paquete "Basic" gratuito verificado; contenido en alemán; planes de pago caros `[dato de 2023, antiguo]` | Baja — solo si se activa el mercado alemán |
| **Software.es / Softonic Business** | — | `[NO CONFIRMADO: no aparecen en los resultados para "software de turnos" y no se pudieron verificar — no priorizar]` | Descartada por ahora |

---

## 3. Descripción base actualizada (ES y EN, tres longitudes)

Reutilizable en cualquier directorio salvo G2 Digital Markets, que exige texto único (usar §2.2.4). Incluye ya el **Hospital Universitario Clínico San Cecilio – Servicio de Urología (Granada)** entre los clientes y el "creado por un enfermero en activo".

### 3.1 Español

**≤ 150 caracteres — 141**
```
Software español de turnos con IA creado por un enfermero en activo. Cuadrantes completos en segundos respetando el convenio. Desde 29 €/mes.
```

**≤ 300 caracteres — 287**
```
Shiftia es un software español de planificación de turnos con IA, creado por un enfermero en activo. Genera el cuadrante mensual completo en segundos respetando el convenio y, ante una baja, propone 3 candidatos de la propia plantilla en menos de un segundo. Tarifa plana desde 29 €/mes.
```

**≤ 1.000 caracteres — 992**
```
Shiftia es un software español de planificación de turnos con inteligencia artificial, creado en Oviedo por un enfermero en activo de la sanidad pública. Genera el cuadrante mensual y anual completo en segundos respetando el convenio: descansos mínimos entre turnos, máximo de noches, jornadas reducidas y conciliación. Ante una ausencia, el motor de IA analiza 11 criterios y propone 3 candidatos de la propia plantilla en menos de un segundo; la decisión final siempre es humana. Incluye lector de PDF y Excel con IA, vacaciones y ausencias, equidad nocturna, detector de conflictos, radar de riesgo a 14 días y auditoría exportable. Tarifa plana desde 29 €/mes, sin coste por trabajador y sin permanencia, con implantación en 5-7 días laborables. Lo usan el Servicio de Urología del Hospital Universitario Clínico San Cecilio de Granada, servicios sanitarios en Asturias, SPAR Supermercados, NONWATIO y La Otra Abacería. Si funciona en un hospital, funciona en cualquier sector con turnos.
```

### 3.2 Inglés

**≤ 150 characters — 143**
```
Spanish AI shift scheduling software built by a working nurse. Full labour-agreement-compliant rosters in seconds. Flat pricing from €29/month.
```

**≤ 300 characters — 289**
```
Shiftia is a Spanish AI shift scheduling software built by a nurse who still works in the public health system. It builds the full monthly roster in seconds under the collective labour agreement and, when someone is absent, suggests 3 in-house candidates in under a second. From €29/month.
```

**≤ 1.000 characters — 976**
```
Shiftia is a Spanish AI-powered shift scheduling and rostering platform, built in Oviedo by a nurse who still works in the public health system. It generates the complete monthly and yearly roster in seconds under the collective labour agreement: minimum rest between shifts, maximum night shifts, reduced working hours and work-life balance rules. When someone is absent, the AI engine scores 11 criteria and suggests 3 candidates from the company's own staff in under a second; the final decision is always human. It also includes an AI reader for PDF and Excel rosters, holiday and absence management, night-shift fairness metrics, a conflict detector, a 14-day risk radar and an exportable audit trail. Flat pricing from €29/month, no per-employee fee, no lock-in, go-live in 5-7 working days. Users include the Urology Department of Hospital Universitario Clínico San Cecilio in Granada, healthcare services in Asturias, SPAR Supermercados, NONWATIO and La Otra Abacería.
```

### 3.3 Reglas al recortar o adaptar

- No decir nunca que Shiftia tiene **fichaje/registro horario, nómina propia o app nativa**. Sí se puede decir: "se integra con nómina (plan Business)" e "integraciones a medida con fichaje (Enterprise)".
- No llamarse "#1", "líder" ni "el mejor": además de que Capterra lo prohíbe, autocoronarse dispara el efecto rebote (la IA acaba recomendando a un competidor el 43 % de las veces, Ahrefs jul-2026).
- Del cliente de Granada solo esta formulación: *"el Servicio de Urología del Hospital Universitario Clínico San Cecilio de Granada planifica sus turnos con Shiftia"*. Sin nombres de personas, sin citas textuales, sin cifras de ahorro atribuidas a ese cliente. **Y solo con la autorización por escrito del servicio** (mismo requisito y mismo mensaje sugerido que en `prensa-pitches.md` §6.3): una ficha de directorio es tan pública como una nota de prensa.
- Nada de residencias como cliente. Se puede decir que Shiftia se dirige al sector sociosanitario y que el convenio es configurable; **no** que "se usa en residencias": no hay ninguna entre los clientes de la ficha de marca.
- Del cliente sanitario asturiano, solo "servicios sanitarios en Asturias" (es confidencial).
- Cifras permitidas: 3 candidatos en < 1 s, 11 criterios, 5-7 días de implantación, 30 días de garantía, "~18 h al mes" y "~4.800 €/año" **siempre con "~" o "estimado"**. Nada de porcentajes de mejora por cliente.
- Si un directorio pide "número de clientes" o "número de usuarios": dejarlo en blanco. No hay cifra publicable.

---

## 4. Google Business Profile: categorías, elegibilidad, verificación

**Los textos ya están escritos y no se duplican aquí.** Ver `docs/visibilidad/perfiles-entidad.md` §1: datos básicos (§1.1), **descripción de negocio de 741 caracteres** (§1.2), atributos y lista de servicios (§1.3), tres publicaciones iniciales (§1.4), **cinco preguntas y respuestas propias** (§1.5) y fotos (§1.6). Esta sección solo añade lo verificado sobre la plataforma.

### 4.1 Decisión previa: ¿es Shiftia elegible?

Texto oficial de Google (verificado): *"Para que una empresa pueda tener un Perfil de Empresa, debe haber alguien que atienda a los clientes de forma presencial durante el horario indicado"*, y **"marcas, organizaciones, artistas y otras empresas que solo existan en Internet"** no pueden tener perfil. Tampoco valen apartados de correos ni oficinas virtuales.

Aplicado a Shiftia, hay tres caminos:

1. **Oficina real en Oviedo** donde se reciba a clientes, aunque sea con cita → perfil con dirección visible.
2. **Negocio de área de servicio** (la vía que asume `perfiles-entidad.md`): si la implantación guiada de 5-7 días incluye **visitas presenciales a clientes**, se crea el perfil con la dirección **oculta** y se declara la zona de servicio. Es la opción realista.
3. **No crear GBP** y concentrar el esfuerzo en Crunchbase, Wikidata, LinkedIn y el `sameAs` de la web.

Si no se cumple 1 ni 2, **no crear el perfil**: un SaaS puro sin atención presencial encaja en "solo existe en Internet" y el perfil puede acabar suspendido, que es peor que no tenerlo.

**Matiz verificado a coordinar con `perfiles-entidad.md` §1.1:** ese fichero propone zona de servicio "España". La documentación oficial de Google dice que se pueden declarar **hasta 20 áreas de servicio** y que *"los límites del área total no deberían superar unas 2 horas de conducción desde la base del negocio"*. Con base en Oviedo, eso da Asturias y provincias limítrofes, no España entera. Decisión recomendada: **declarar Asturias (y, si se quiere, León y Cantabria)** y explicar en la descripción y en los servicios que se trabaja en remoto con toda España — la descripción de `perfiles-entidad.md` §1.2 ya lo permite sin tocarla. Los clientes de Gran Canaria, Valencia y León quedan fuera del área declarable, lo cual no impide atenderlos.

### 4.2 Categorías

| Campo | Valor |
|---|---|
| **Categoría principal** | **Empresa de software** (equivalente español de *Software company*) |
| **Categorías secundarias** | **Empresa de desarrollo de software** · **Servicio de informática** |
| **No marcar** | "Consultoría de recursos humanos" (Shiftia no presta consultoría), ni ninguna categoría de ETT, selección de personal o asesoría laboral |

`[NO CONFIRMADO: la categoría en inglés "Software company" está verificada en una guía de terceros (gmbeverywhere.com), pero la etiqueta literal en español y las secundarias "Empresa de desarrollo de software" y "Servicio de informática" no se pudieron extraer del listado oficial de categorías de Google (la herramienta PlePer requiere JavaScript). Cómo comprobarlo: al crear el perfil, escribir "software" en el selector de categoría y elegir la que aparezca literalmente; anotar aquí el rótulo exacto que muestre el formulario. Referencias en inglés vistas en la guía: "IT support and services" y "Computer consultant" como secundarias.]`

Nombre del negocio: **`Shiftia`** a secas. Añadir palabras clave al nombre ("Shiftia — software de turnos") es motivo de penalización.

### 4.3 Verificación (verificado en el soporte oficial)

- Métodos posibles según elegibilidad: **teléfono o SMS, email, vídeo grabado, videollamada en directo y correo postal**. La videollamada en directo *"solo está disponible dentro del horario de apertura declarado"*, así que conviene que el horario del perfil sea real. El correo postal llega en **14 días** y el código **caduca a los 30**.
- En el **vídeo grabado** hay que mostrar tres cosas seguidas y sin cortes: (a) la ubicación —rótulos exteriores, negocios cercanos o una placa de calle—, (b) el negocio —producto, equipo con marca, material de marketing— y (c) la gestión —acceso a zonas de solo empleados o documentación de la empresa. Revisión posterior de **hasta 5 días laborables**.
- Guion sugerido para el vídeo de Shiftia: placa de la calle en Oviedo → entrada del espacio de trabajo → puesto con Shiftia abierto en pantalla generando un cuadrante → documento de la empresa (alta censal o similar) con la razón social visible. Grabar en una sola toma.
- Aviso de fuentes del sector 2026: la mayoría de los rechazos se producen **en el paso de clasificación del tipo de negocio**, no en el vídeo. Es decir: lo que hay que preparar bien es la respuesta a "¿atiendes a clientes en tu dirección?".

### 4.4 Después de verificar

1. Copiar el **enlace corto de reseñas** (Perfil → "Pedir reseñas") y pegarlo en `docs/visibilidad/resenas-mensajes.md` §1.1.
2. Publicar las 3 publicaciones iniciales y las 5 preguntas y respuestas de `perfiles-entidad.md` §1.4 y §1.5 el mismo día.
3. Añadir la URL del perfil al bloque `sameAs` (`perfiles-entidad.md` §6).

---

## 5. Petición de inclusión en listicles y comparativas

### 5.1 Los 16 artículos localizados (leídos el 07/09/2026; **ninguno menciona a Shiftia**)

| # | Artículo / URL | Medio (tipo) | Autor · fecha | Herramientas que incluye | Contacto confirmado | ¿Pedir inclusión? |
|---|---|---|---|---|---|---|
| 1 | "12 mejores software Gestión de Turnos [comparativa 2026]" — `https://www.softwaredoit.es/recursos-humanos/software-gestion-turnos.html` | SoftDoit (comparador neutral) | "Validado por Lluís Soler, cofundador de SoftDoit" · sin fecha de actualización visible en la página (el HTML da publicación 02/05/2023 y modificación 10/06/2026) | Bizneo HR Suite, Sesame HR, Factorial HR, Plano WFM, ERA PLAN, aTurnos, Kronjop, Freematica, netTime one, Skello, Deputy, Woffu | `hola@softdoit.com` · `atencionalcliente@softdoit.com` · 911 98 20 00 · formulario Notion (§2.1) | **Sí — prioridad 1.** Vía natural: el alta del paso 1.1 |
| 2 | "Mejor software de turnos en 2026: comparativa y guía para elegir" — `https://www.tramitapp.com/blog/mejor-software-de-turnos/` | TramitApp (competidor) | Eva Gauche · 02/04/2026 | TramitApp, Factorial, Sesame HR, aTurnos, Skello, Mapal OS, Nivimu | Formulario `https://www.tramitapp.com/contacta-con-nosotros/` (sin email público) | No. Usar como benchmark |
| 3 | "Comparativa 2026 de software para planificar turnos…" — `https://blog.aturnos.com/comparativa-2026-de-software-para-planificar-turnos-y-gestionar-personal-en-espana/` | aTurnos (competidor) | Marta Sánchez Díaz · 09/07/2026 | Factorial, Sesame, Bizneo HR, aTurnos, Skello, PG Planning | Solo "Solicitar demo" | No |
| 4 | "El mejor software de gestión de turnos para pymes en España 2026" — `https://www.shiftbase.com/es/blog/software-gestion-turnos` | Shiftbase (competidor NL) | Rinaily Bonifacio · act. 04/05/2026 | Shiftbase, Factorial, Sesame HR, Kenjo, Skello, Bizneo | `info@shiftbase.com` · +34 930 46 65 32 | No |
| 5 | "5 alternativas a aTurnos en 2026 · Precios" — `https://turnozo.com/es/blog/alternativas-a-aturnos` | Turnozo (competidor) | Diego Cárdenas (fundador) · 05/08/2026 | Turnozo, Skello, Woffu, Sesame HR, Bizneo HR | `/es/contacto` · WhatsApp +34 641 987 253 | No |
| 6 | "Alternativa a aTurnos" — `https://qadra.app/alternativa-aturnos` | Qadra (competidor) | sin autor ni fecha | aTurnos vs Qadra | WhatsApp +34 602 401 702 · `/contacto` | No |
| 7 | "Los 5 mejores programas para hacer turnos rotativos gratis" — `https://blog.kenjo.io/es/los-5-mejores-programas-para-hacer-turnos-rotativos-gratis` | Kenjo (competidor DE/ES) | sin autor ni fecha visible | Kenjo, Workday, aTurnos, PGplanning, Nubhora | Formulario de demo | No |
| 8 | "8 programas para hacer horarios de trabajo" — `https://www.holded.com/es/blog/programas-hacer-horarios` | Holded (ERP, **neutral en turnos**) | José Antonio Calvo · pub. 22/10/2025, act. 14/07/2026 | Holded, Timecamp, Workday, aTurnos, Papershift, Gesturn, Express Schedule, PGPlanning | +34 930 34 01 71 · `help.holded.com` (sin email editorial) | **Sí — prioridad 2.** No compite en turnos con IA |
| 9 | "Los 7 mejores programas para hacer turnos rotativos (act. 2025)" — `https://www.appvizer.es/revista/recursos-humanos/control-horario-empleados/programa-para-hacer-turnos-rotativos-gratis` | Appvizer (comparador neutral) | María Fernanda Aguirre y Daniela Lorenzo Correa · 07/04/2025 | Factorial, aTurnos, Gesturn, LaborOfficeFree, Papershift, Tempusbasic, Workday | Alta de proveedor (§2.6) · `help.appvizer.com` | **Sí — prioridad 1.** Artículo de 2025: le toca actualización |
| 10 | "Sistemas de gestión de turnos: comparativa de software 2026" — `https://www.skello.es/blog/sistema-de-gestion-de-turnos-guia` | Skello (competidor FR) | "Laura" · act. 13/06/2026 | Skello, Factorial, Sesame HR, TIMIFY, SimplyBook.me, Bookitit, Setmore | +34 93 220 44 42 | No |
| 11 | "Los mejores softwares de control horario en España (sept. 2026)" — `https://fichme.com/comparativas/mejores-softwares-control-horario` | FichMe (competidor control horario) | Matías Maquieira · pub. 29/05/2026, act. 28/08/2026 | 25 herramientas (FichMe, Factorial, Sesame, Bizneo, Holded, Woffu, Personio, Kronjop, aTurnos, Skello, Shiftbase…) | Sección "Contacto" del sitio (sin email público) | No — y además es de control horario, no de turnos |
| 12 | "Los 10 mejores softwares de gestión de turnos para empresas" — `https://www.kelio.es/recursos/blog/los-mejores-softwares-gestion-turnos-para-empresas.html` | Kelio (competidor) | sin autor · 08/06/2026 | Kelio, Grupo Spec (Octime), Softmachine, Cegid, SAP SuccessFactors, Oracle HCM, Factorial, Sesame, Personio, Bizneo | 91 597 00 42 · 93 564 23 48 | No |
| 13 | "Software de Gestión para Residencias de Mayores 2026: Comparativa y Precios" — `https://www.cuadly.es/blog/residencias/software-gestion-turnos-residencias-mayores` | Cuadly (competidor nicho residencias; `www.resiturn.es` redirige de forma permanente —HTTP 308— a `www.cuadly.es`, y Cuadly no menciona ResiTurn en su web) | Cuadly · 18/07/2026 | Por categorías con rangos de precio, sin marcas (turnos y cuadrantes: 50-150 €/mes) | `contacto@cuadly.es` | No |
| 14 | "Los 5 mejores software para gestionar turnos en hospitales y residencias" — `https://plain.ninja/blog/software-turnos-hospitales-residencias/` | Plain (competidor) | María Alcaraz · 11/03/2026 | Plain, Kenjo, Bizneo HR, Quinyx | Email protegido por Cloudflare (no legible) | No |
| 15 | "Mejores apps y programas para hacer cuadrantes y horarios" — `https://blogempresas.masmovil.es/apps-programas-cuadrantes-horarios/` | MASMOVIL Negocios (**medio neutral**) | "Blog Negocios" · 19/05/2017, act. 21/09/2022 | Tiny Calendar, Daily Planner, Microsoft Planner, Tempus Basic, aTurnos, Timr | Sin formulario editorial; redes sociales | **Sí — prioridad 3.** Contenido de 2022: el argumento es que está desactualizado |
| 16 | "Mejor Software para Residencias en 2026" — `https://www.softwaredoit.es/software-medico/software-residencias.html` | SoftDoit | Lluís Soler Gomis · 2026 | Clinic Cloud, Archivex, flowww, Healthie, Jane (software médico, ninguno de turnos) | Igual que el nº 1 | **Sí — prioridad 1.** Hueco evidente: no hay ni un software de turnos |

**Otros listicles detectados pero no leídos** (el cupo de búsquedas se agotó): `rankiabusiness.com/software-control-horario/`, `fichahoy.com/mejor-software-control-horario/`, `controlatushoras.com` "8 mejores software de control horario en 2026", `factorial.es/blog/mejores-softwares-rrhh-comparativa/`, `qadra.app/blog/programas-turnos-rotativos-gratis`, `turnozo.com/es/blog/alternativas-a-woffu`, `cronoshare.com` "mejores software residencias ancianos". `[NO CONFIRMADO: no se ha comprobado su contenido, fecha, autor ni si mencionan a Shiftia. Cómo comprobarlo: abrir cada URL, buscar "Shiftia" en la página y anotar autor, fecha y contacto antes de escribir a nadie.]`

**Regla de outreach:** 12 de los 16 artículos los firma un competidor directo que se incluye a sí mismo. Pedirles inclusión es perder el tiempo y regalarles información. Escribir **solo a los neutrales** (SoftDoit, Appvizer, Holded, MASMOVIL, y los comparadores donde ya haya ficha: Capterra/GetApp y ComparaSoftware). A los competidores se les usa como referencia de datos para la comparativa propia `/mejores-software-turnos-espana`.

**Nunca inventar el nombre del periodista.** Donde la tabla no da nombre, escribir "Hola" o "Hola, equipo de [MEDIO]". Los nombres que sí figuran (Lluís Soler Gomis, José Antonio Calvo, María Fernanda Aguirre, Daniela Lorenzo Correa) están verificados en la firma del artículo; el resto son de competidores a los que no se escribe.

### 5.2 Plantilla de email en español (9 líneas de cuerpo, sin contar asunto ni firma)

Sustituir `[NOMBRE]`, `[TÍTULO]` y `[URL]` por los de la tabla. Enviar desde `info@shiftia.es` o desde el correo personal de Diego con firma.

**Dos comprobaciones antes de pulsar enviar:**
- El último párrafo enlaza `https://www.shiftia.es/mejores-software-turnos-espana`. Esa página forma parte del Bloque 3 y **a 07/09/2026 no está publicada**. Si en el momento del envío todavía no está en línea, quita ese párrafo entero: enlazar un 404 a un comparador es la forma más rápida de que no te vuelvan a leer.
- La mención al **Servicio de Urología del Hospital Universitario Clínico San Cecilio (Granada)** exige la misma autorización por escrito que se pide en `prensa-pitches.md` §6.3. Un correo a un comparador es difusión pública igual que una nota de prensa. Sin autorización, sustituir por "un servicio de urología de un hospital público" y no dar el nombre del centro.

```
Asunto: Propuesta para vuestra comparativa de software de turnos: falta una opción española con IA

Hola [NOMBRE]:

Soy Diego Ciborro, enfermero en activo en la sanidad pública y fundador de Shiftia (shiftia.es), un software español de planificación de turnos con IA hecho en Oviedo.

Os escribo por vuestro artículo "[TÍTULO]" ([URL]): le falta una opción que encaja justo en el hueco que dejan las herramientas que citáis, y os paso los datos por si os sirven para actualizarlo.

- Precio público y plano: 29 €/mes hasta 15 trabajadores, 69 € hasta 40 y 129 € hasta 100. Sin coste por trabajador, sin permanencia y con garantía de devolución de 30 días.
- IA aplicada al cuadrante, no al chat: genera el cuadrante mensual completo respetando el convenio (descansos mínimos, máximo de noches, jornadas reducidas, conciliación) y, ante una baja, propone 3 candidatos de la propia plantilla en menos de un segundo analizando 11 criterios. La decisión final siempre es humana.
- Clientes reales en varios sectores: el Servicio de Urología del Hospital Universitario Clínico San Cecilio de Granada, servicios sanitarios en Asturias, SPAR Supermercados, NONWATIO y La Otra Abacería.
- Implantación en 5-7 días laborables y demo interactiva sin registro ni tarjeta.

Como referencia de datos, nosotros publicamos nuestra propia comparativa con precios verificados y fecha de consulta, competidores incluidos: https://www.shiftia.es/mejores-software-turnos-espana. Y si os viene bien, os doy acceso de prueba, capturas o una demo en directo cuando queráis.

Un saludo,
Diego Ciborro · Fundador de Shiftia · info@shiftia.es · 663 50 46 47
```

Variante para el nº 15 (MASMOVIL, artículo de 2022), sustituyendo el segundo párrafo:

```
Os escribo por vuestro artículo "[TÍTULO]" ([URL]). Se actualizó por última vez en 2022 y el mercado español de turnos ha cambiado mucho desde entonces: han entrado herramientas con IA y con precio plano publicado. Si os planteáis refrescarlo, os paso datos concretos y verificables.
```

Variante para el nº 16 (SoftDoit, "Mejor Software para Residencias"), sustituyendo el segundo párrafo:

```
Os escribo por vuestro artículo "[TÍTULO]" ([URL]). Los cinco productos que listáis son software médico o de gestión de centro, y ninguno resuelve el cuadrante de turnos, que es justo lo que más consume tiempo a una coordinadora de residencia: ratios por turno, noches repartidas y cobertura de bajas. Os paso los datos por si encaja añadir un apartado de turnos.
```

### 5.3 Plantilla en inglés (directorios y medios internacionales)

```
Subject: Missing option for your shift scheduling comparison: a Spanish AI scheduler

Hi [NAME],

I am Diego Ciborro, a registered nurse still working in the Spanish public health system and the founder of Shiftia (shiftia.es), an AI shift scheduling platform built in Oviedo, Spain.

I am writing about your article "[TITLE]" ([URL]). Shiftia is not listed there, and it covers a gap the current entries leave open, so here are the facts in case they are useful for an update.

- Public flat pricing: €29/month up to 15 employees, €69 up to 40, €129 up to 100. No per-employee fee, no lock-in, 30-day money-back guarantee.
- Scheduling AI, not a chatbot: it builds the full monthly roster under the collective labour agreement (minimum rest, maximum night shifts, reduced hours, work-life balance) and, when someone is absent, proposes 3 candidates from the company's own staff in under a second, scoring 11 criteria. The final decision is always human.
- Customers across sectors: the Urology Department of Hospital Universitario Clínico San Cecilio (Granada), healthcare services in Asturias, SPAR Supermercados, NONWATIO and La Otra Abacería.
- Go-live in 5-7 working days, interactive demo with no sign-up and no credit card.

We publish our own comparison with verified prices and access dates, competitors included: https://www.shiftia.es/mejores-software-turnos-espana. Happy to provide a test account, screenshots or a live demo.

Best regards,
Diego Ciborro · Founder, Shiftia · [EMAIL] · [PHONE]
```

### 5.4 Seguimiento

- Un solo recordatorio a los **7-10 días**, de tres líneas, sin reproches. Si no contestan, se cierra.
- Registrar cada envío en el tracker (`docs/visibilidad/tracker-visibilidad-shiftia.xlsx`): medio, URL, fecha de envío, fecha de recordatorio, respuesta.
- Cuando un motor de IA cite un listado en el que Shiftia no está (protocolo mensual de `gsc-y-geo-seguimiento.md` §4.1), añadir ese artículo a esta tabla y aplicarle la misma plantilla.

---

## 6. Orden recomendado, tiempos y checklist

### 6.1 Orden y tiempo estimado

| # | Tarea | Tiempo | Por qué en este orden |
|---|---|---|---|
| 0 | **Preparar el material común** (§2.0): 5 capturas, logo, teléfono, entidad legal, email corporativo | **60-90 min** | Sin las capturas, ninguna ficha se puede terminar. Es el cuello de botella real |
| 1 | **G2 Digital Markets** (Capterra + GetApp + Software Advice) | **45-60 min** | Máximo impacto: Capterra es el resultado nº 1 para "alternativas a aTurnos" y un solo alta cubre tres plataformas. Además la revisión tarda días: cuanto antes se envíe, antes corre el reloj |
| 2 | **SoftDoit**: formulario Notion | **5 min** (+ llamada de 30-45 min los días siguientes) | Es el directorio español de referencia y controla dos de los listicles objetivo |
| 3 | **Google Business Profile** (§4 + `perfiles-entidad.md` §1) | **25 min** + verificación (hasta 5 días laborables) | Decidir antes la elegibilidad. La verificación es lenta: lanzarla pronto |
| 4 | **G2.com** | **20 min** | Cuarto dominio más citado por ChatGPT; aprobación de 3-5 + 1-3 días |
| 5 | **ComparaSoftware** | **20 min** | Categoría copada por producto anglosajón: hueco fácil |
| 6 | **Appvizer** | **20 min** | Validación en 24 h y abre la puerta a su artículo de turnos rotativos |
| 7 | **Crunchbase** (`perfiles-entidad.md` §2) | **30 min** | Señal de entidad para los LLM |
| 8 | **TrustRadius** | **15 min** | Perfil básico gratuito |
| 9 | **Petición de reseñas** a los 5 clientes (`resenas-mensajes.md`) | **30 min** | En cuanto existan las URL de perfil y el enlace corto de Google. Sin reseñas, las fichas quedan al final de la categoría |
| 10 | **Outreach a los 4 listicles neutrales** (§5) | **45 min** | Después de tener ficha: da credibilidad al email |
| 11 | Wikidata y Product Hunt (`perfiles-entidad.md` §§4-5) | 30 min / 2-4 semanas | Opcionales, al final |

**Total sin esperas: unas 5-6 horas**, repartibles en dos tardes. Los plazos de revisión (1-5 días laborables según plataforma) corren en paralelo.

### 6.2 Checklist final

**Preparación**
- [ ] Email corporativo `info@shiftia.es` operativo y revisado a diario
- [x] Teléfono decidido y publicable: 663 50 46 47 (provisional, 7 sep 2026)
- [ ] Forma jurídica y nombre registral exactos confirmados
- [ ] Dirección postal de Oviedo confirmada (y decidido si se muestra u oculta)
- [ ] Logo PNG cuadrado con margen (≥512 px, fondo transparente)
- [ ] Las 5 capturas exportadas con datos ficticios: cuadrante mensual · motor de coberturas con 3 candidatos · equidad nocturna · alerta de conflicto · lector PDF
- [ ] Decidido si se graba vídeo en inglés (YouTube público) o solo capturas
- [ ] Sede unificada en toda la comunicación: **Oviedo** (hoy LinkedIn dice "Langreo" y la web "Asturias")
- [ ] Nombre unificado: **Shiftia** (LinkedIn dice hoy "ShiftIA")

**Altas**
- [ ] G2 Digital Markets enviado · categorías Employee Scheduling + Nurse Scheduling + Workforce Management · descripciones ES y EN de §2.2.4 · 5 capturas subidas
- [ ] Verificado que **no** se ha marcado fichaje, nómina, app nativa ni ETT en ningún checklist
- [ ] SoftDoit: formulario enviado y llamada agendada; precios de premium/PPC pedidos por escrito
- [ ] SoftDoit: categorías pedidas — Gestión de Turnos, Residencias Geriátricas, Hospitales, Clínicas, Vacaciones (**no** Control Horario)
- [ ] GBP: elegibilidad decidida (oficina o área de servicio) y perfil creado o descartado por escrito
- [ ] GBP: categoría literal del selector anotada en este documento (sustituye al `[NO CONFIRMADO]` de §4.2)
- [ ] GBP: verificación superada y enlace corto de reseñas copiado a `resenas-mensajes.md`
- [ ] G2.com, ComparaSoftware, Appvizer, TrustRadius y Crunchbase completados

**Después**
- [ ] URL de los perfiles guardadas y añadidas al bloque `sameAs` (`perfiles-entidad.md` §6)
- [ ] Reviews Collection activado en el portal de vendor, usando **su** enlace; sin incentivo para el cliente de sanidad pública
- [ ] Petición de reseña enviada a los 5 clientes (`resenas-mensajes.md`)
- [ ] Emails de inclusión enviados a SoftDoit (dos artículos), Appvizer, Holded y MASMOVIL
- [ ] Todo registrado en `tracker-visibilidad-shiftia.xlsx` con fecha
- [ ] Repaso al mes: ¿aparece ya la ficha al buscar "Shiftia" en cada directorio? ¿Cuántas reseñas hay?

### 6.3 Datos pendientes que bloquean alguna alta

| Dato | Lo pide | Cómo se resuelve |
|---|---|---|
| Teléfono | SoftDoit (obligatorio), GBP | Decisión de Diego |
| Forma jurídica y nombre registral | Capterra, Crunchbase, GBP (verificación) | Escritura o alta censal |
| Año de fundación | Capterra, Crunchbase, LinkedIn, GBP | Registro mercantil o alta de actividad |
| Número de empleados | Capterra, Crunchbase, LinkedIn | Decisión de Diego (rango) |
| Dirección postal en Oviedo | GBP | Decisión de Diego |
| Idiomas de soporte real | Capterra, GBP | Decisión de Diego (la interfaz sí está en es/en/de/fr) |
| Existencia del flujo de intercambio de turnos entre empleados | Checklist de Capterra (§2.2.5) | Comprobar en producto antes de marcar |
| Aviso legal de shiftia.es | Refuerza la verificación en todos los directorios | Hoy devuelve 404: publicarlo con la entidad legal |
