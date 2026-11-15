# Auditoría local de usabilidad, reto y producción

## Alcance y método

Auditoría realizada en `http://localhost:5173`, porque todavía no hay URL de Vercel. No se modificó código de la aplicación. Las personas A y B fueron recorridos simulados con contextos de navegador nuevos; no sustituyen pruebas con personas reales. Se usaron únicamente textos y estados visibles en la interfaz para evaluar comprensión. Las pruebas técnicas automatizadas y Lighthouse son observaciones locales, no resultados de producción.

Los clics son aproximados: cuentan las acciones de interfaz del recorrido, no el tecleo, las esperas, ni todas las interacciones internas de los diálogos nativos de archivo. “Duda” y “desvío” indican lo observado por el evaluador durante la simulación; no son declaraciones de usuarios reales.

## Persona A — Astronauta en misión larga

| Tarea | Resultado y clics | Duda / desvío observado | Texto exacto relevante | Severidad | Evidencia |
|---|---|---|---|---|---|
| 1. Explicar el propósito tras 10 s | Éxito; 0 clics. Interpretación del evaluador: importar y revisar datos personales y aprender sobre salud espacial; no diagnostica. | Propósito entendible, pero no promete orientación clínica. No es una cita de una persona real. | “Your health. Your mission.” / “Import your health records, understand your body, and explore how space affects astronauts.” | — | [Bienvenida](../docs/screenshots/audit/persona-a-01-welcome.png) |
| 2. Crear perfil | Éxito; 3 clics principales. | Sin desvío observado; hay que proporcionar un nombre e ID antes de entrar al espacio personal. | “Only basic details are needed to get started. Your data stays locally in this browser.” | Menor | [Perfil creado](../docs/screenshots/audit/persona-a-02-profile.png) |
| 3. Check-in de hoy con dolor de cabeza | Éxito; aprox. 3 clics. | La autoevaluación queda separada de mediciones importadas; no se observó una duda bloqueante. | “Your daily self-report is saved on this device. You can edit it again today.” / “Headache” | — | [Check-in guardado](../docs/screenshots/audit/persona-a-03-checkin-saved.png) |
| 4. Descargar plantilla, completarla e importarla | Éxito; aprox. 7 acciones. Se importaron 3 mediciones. | La importación requiere plantilla/archivo, categoría y origen; no ofrece entrada manual. La explicación y plantillas están presentes, aunque el flujo tiene varios pasos. | “Measurements enter the app only by importing a personal time-series file.” / “Imported 3 records. Skipped invalid rows: 0.” | Mayor por fricción | [Vista previa válida](../docs/screenshots/audit/persona-a-04-valid-preview.png) |
| 5. Importar archivo inválido y entender el error | Éxito; aprox. 2 acciones hasta la validación. El error identifica el campo y el formato esperado. | No hubo desvío. La interfaz permite continuar importando 0 filas válidas, pero lo advierte explícitamente. | “timestamp · INVALID_TIMESTAMP: timestamp must be a valid ISO 8601 date or date-time string.” / “Correct each listed row and upload a TUMI-HEALT CSV template.” | Menor | [Importación inválida](../docs/screenshots/audit/persona-a-06-broken-import.png) |
| 6. Encontrar qué cambió en sueño o pulso | Parcial; 1 clic para Tendencias. La lectura de pulso fue visible, pero una tarjeta “Blood pressure” mostró datos `heart_rate`. | El nombre de indicador y unidad no corresponden a los valores mostrados; podría confundir la interpretación. | “Blood pressure” junto a “heart_rate”, “75 bpm” y “3 records”. | **Mayor** | [Tendencias](../docs/screenshots/audit/persona-a-07-trends.png) |
| 7. Saber cuándo contactar al equipo médico y preparar solicitud | Parcial; aprox. 3 acciones para abrir, completar y guardar la solicitud. Se guardó localmente; no se contactó a un equipo. | No se encontró un umbral operativo para decidir cuándo escalar. La interfaz sí deja claro que la solicitud no se envía. | “Request saved locally as Pending (local).” / “No connection to the medical team exists in this app.” | **Mayor** | [Solicitud pendiente](../docs/screenshots/audit/persona-a-review-request-saved.png) |
| 8. Respaldar datos | Éxito; 2 clics principales. Se descargó un JSON de respaldo (esquema 4, tres registros cardiovasculares, un check-in y checksum). | Hay que acudir a “Mission & Privacy”; el texto explica que el checksum no es cifrado. | “JSON backups include a SHA-256 checksum for data integrity verification (not encryption).” | Menor | [Privacidad y respaldo](../docs/screenshots/audit/persona-a-09-backup.png) |

**Resumen A.** 6 tareas completas y 2 parciales. El tiempo de primera utilidad no se midió de forma fiable: el perfil por sí solo lleva a un espacio sin mediciones (“No data yet”); los primeros datos de dispositivo aparecieron tras la importación. La fricción principal fue depender de archivos; la segunda, la tarjeta de presión arterial inconsistente; la tercera, no disponer de un criterio explícito de escalamiento médico. No se observó un desvío de navegación que pueda atribuirse a una persona real.

## Persona B — Estudiante/juez sin experiencia médica ni archivos

| Tarea | Resultado y clics | Duda / desvío observado | Texto exacto relevante | Severidad | Evidencia |
|---|---|---|---|---|---|
| 1. Explicar el propósito | Éxito; 0 clics. La bienvenida menciona importar registros, entender el cuerpo y efectos del espacio. | “Your health. Your mission.” es un lema; la frase descriptiva aporta la explicación concreta. Interpretación simulada, no respuesta humana. | “Import your health records, understand your body, and explore how space affects astronauts.” | — | [Bienvenida](../docs/screenshots/audit/persona-b-01-welcome.png) |
| 2. Llegar a algo útil sin archivos | Parcial; 3 clics principales para crear perfil y entrar al inicio. El inicio es navegable, pero no tiene mediciones personales. | Para ver datos de ejemplo hay que entrar al demo; la cuenta personal vacía no presenta datos útiles de dispositivo. | “No data yet.” | Mayor | [Inicio personal](../docs/screenshots/audit/persona-b-02-home.png) |
| 3. Explorar demo y explicar los puntos del cuerpo | Éxito; aprox. 4 clics hasta abrir Body Explorer y seleccionar Sleep. La explicación aclara el mapa y las regiones. | El demo no representa registros propios y está separado del perfil. | “DEMO DATA — Synthetic example data only. Your personal records are untouched.” / “Dots are body areas you can select.” | — | [Demo](../docs/screenshots/audit/persona-b-03-demo.png), [Sleep en Body Explorer](../docs/screenshots/audit/persona-b-04-body-sleep.png) |
| 4. Explicar una etiqueta de estado | Éxito; sin clic adicional tras seleccionar Sleep. “Within your usual range” se acompaña de una mediana personal; no se presenta como umbral médico. | La explicación aparece dentro del panel del sistema seleccionado. | “Within your usual range” / “Personal median 6.90 hours across 6 samples.” | — | [Estado Sleep](../docs/screenshots/audit/persona-b-04-body-sleep.png) |
| 5. Encontrar por qué el espacio afecta el sueño o el corazón | Éxito; sin clic adicional: la explicación “Level 2” está visible en el panel. | La relación se explica en lenguaje sencillo; las fuentes técnicas requieren desplegar detalles en otras páginas. | “Rapid orbital sunrises/sunsets, mission workloads, and isolation and confinement can disrupt sleep duration, latency (time to fall asleep), and efficiency.” | Menor | [Explicación espacial](../docs/screenshots/audit/persona-b-04-body-sleep.png), [Riesgos espaciales](../docs/screenshots/audit/challenge-space-hazards.png) |
| 6. Intentar añadir una medición sin archivo | Parcial; aprox. 2 clics para intentar la acción y llegar a la importación personal. No hay formulario manual. | En demo se explica que la importación está deshabilitada y se indica salir del demo; después, la pantalla personal dice que los datos entran importando un archivo. Explica el límite, pero no lo elimina. | “Personal data import is disabled in Demo Mode so demonstration data stays separate from your records. Exit Demo Mode to import personal files.” / “Measurements enter the app only by importing a personal time-series file.” | **Mayor** | [Importación personal a 375 px](../docs/screenshots/audit/persona-b-05-import-only-personal-375.png) |
| 7. Salir del demo y confirmar que el perfil propio sigue intacto | Éxito; 1 clic en “Exit Demo”. Volvió el perfil “Student Judge” y el aviso de demo desapareció. | No se observó alteración del perfil personal. | “Exit Demo” / “Student Judge” | — | [Después de salir del demo](../docs/screenshots/audit/persona-b-06-after-exit.png) |

**Resumen B.** 5 tareas completas y 2 parciales. El tiempo automatizado hasta el estado útil del demo fue aproximadamente 12,5 s, incluyendo una espera intencional de 10 s; no equivale al tiempo de una persona. El valor del perfil vacío es limitado; el demo proporciona una ruta alternativa, aunque no hay mediciones manuales. La explicación del Body Explorer y la separación del demo fueron claras en pantalla. El menú móvil fijo aparece superpuesto al contenido en la captura larga del mapa; al probarlo en móvil real conviene confirmar cuánto contenido tapa mientras se desplaza.

## Cumplimiento del reto

| Punto del reto | Evaluación | Evidencia en la interfaz local |
|---|---|---|
| Recopila presión arterial, pulso, glucosa, temperatura, sueño y estado de ánimo | **Parcial** | Importación y resumen contemplan pulso, presión arterial, glucosa, sueño y biomarcadores; hay check-in/estado de ánimo. No se encontró temperatura corporal entre los indicadores personales aceptados. [Importación](../docs/screenshots/audit/persona-b-05-import-only.png) |
| Permite evaluar el estado propio | **Cumplido** | Tendencias y Body Explorer muestran valores, conteos, mediana personal y etiquetas de estado. Son comparaciones personales, no diagnósticos. [Estado Sleep](../docs/screenshots/audit/persona-b-04-body-sleep.png) |
| Guía tratamientos y mejoras de salud | **Parcial** | Hay guías y próximos pasos de autocontrol; no se observó un plan de tratamiento ni guía accionable suficiente para todos los resultados. [Guías](../docs/screenshots/audit/challenge-health-guides.png) |
| Explica qué mediciones pueden hacerse en el espacio y por qué | **Parcial** | Se muestran indicadores admitidos y riesgos, pero no una matriz de factibilidad por instrumento/entorno y su razón. [Importación](../docs/screenshots/audit/persona-b-05-import-only.png) |
| Explica los cinco riesgos y sus efectos | **Cumplido, cualitativo** | La pantalla presenta radiación, aislamiento/confinamiento, distancia, gravedad y entorno hostil, con efectos posibles sobre sueño, sangre, corazón y otros aspectos. Declara que no mide directamente dosis de radiación ni calidad del aire. [Riesgos](../docs/screenshots/audit/challenge-space-hazards.png) |
| Indica cuándo involucrar a tripulación o cirujano de vuelo | **Parcial** | Hay recomendación general de contactar al equipo médico si hay preocupación, y no existe conexión de envío. No se encontró un umbral operativo ni protocolo concreto. [Solicitud pendiente](../docs/screenshots/audit/persona-a-review-request-saved.png) |
| Interfaz clara e interactiva | **Cumplido** | Navegación, importación por pasos, demo y controles visibles. Se observaron fricciones en el flujo de archivos y el menú móvil. [Importación móvil](../docs/screenshots/audit/persona-b-05-import-only-personal-375.png) |
| Figura humana seleccionable con función y estado | **Cumplido** | El mapa tiene hotspots, lista accesible de regiones, explicación, valor y estado. En móvil la figura cabe en el ancho probado. [Body Explorer móvil](../docs/screenshots/audit/technical-body-sleep-375.png) |
| Entornos: nave, estación, rover y base de superficie | **No cumplido** | El contexto ofrece opciones de gravedad y un campo de entorno como “ISS / Orbital”; no enumera los cuatro tipos de hábitat/vehículo solicitados. [Contexto de misión](../docs/screenshots/audit/challenge-mission-environments.png) |
| Solicita medir periódicamente | **Parcial** | Hay check-in diario, pero no se observó un calendario/recordatorio periódico para importar mediciones de dispositivo. [Check-in](../docs/screenshots/audit/persona-a-03-checkin-saved.png) |
| Gráficos dinámicos | **Cumplido** | La vista de tendencias cambia con los registros locales importados. La tarjeta de presión arterial observada mostró `heart_rate`, defecto que reduce la confianza. [Tendencias](../docs/screenshots/audit/persona-a-07-trends.png) |
| Código de color de estado | **Cumplido, con límites** | Hay etiquetas de estado y color; el texto acompaña al color. Los colores por sí solos no deben interpretarse como evaluación clínica. [Estado Sleep](../docs/screenshots/audit/persona-b-04-body-sleep.png) |
| Explicaciones simples para público no experto | **Cumplido** | “Simple Explanation” y “Why it matters in space” ofrecen una explicación llana. [Riesgos](../docs/screenshots/audit/challenge-space-hazards.png) |
| Gamificación (opcional) | **No observado; opcional** | No es requisito para considerar el reto cumplido. |

**¿La aplicación local cumple plenamente el reto? No.** Tiene una base útil de autocontrol y educación, pero faltan temperatura corporal y entornos de misión específicos; la guía de escalamiento no es operativa y la experiencia depende de archivos.

## Qué tan bien está planteado el producto

| Criterio | Nota / 5 | Evidencia |
|---|---:|---|
| Claridad del propósito | 4 | La bienvenida explica importar registros, entender el cuerpo y explorar efectos del espacio. [Bienvenida](../docs/screenshots/audit/persona-a-01-welcome.png) |
| Primera experiencia | 3 | Perfil sencillo, pero el inicio vacío muestra “No data yet”; para tener datos de ejemplo hay que encontrar el demo. [Inicio](../docs/screenshots/audit/persona-b-02-home.png) |
| Fricción de importación | 2 | Plantillas CSV/XML/XLSX y errores útiles, pero solo se aceptan series por archivo. [Importación móvil](../docs/screenshots/audit/persona-b-05-import-only-personal-375.png) |
| Calidad y fuentes de orientación | 3 | Explicaciones y niveles de evidencia están presentes; la información técnica y sus detalles no siempre están a la vista. [Riesgos](../docs/screenshots/audit/challenge-space-hazards.png) |
| Confianza y límites | 4 | Se declara que no diagnostica, que el almacenamiento no cifra automáticamente y que la solicitud médica no se envía. No se encontró la frase explícita “no se envía ningún dato”. [Privacidad](../docs/screenshots/audit/persona-a-09-backup.png) |
| Claridad de estados y gráficos | 3 | Hay valores y etiquetas comprensibles, pero la tarjeta “Blood pressure” mostró pulso en bpm. [Tendencias](../docs/screenshots/audit/persona-a-07-trends.png) |
| Uso móvil | 3 | Bienvenida, importación y figura se probaron a 375 px sin desbordamiento horizontal; el menú inferior fijo se superpone a contenido del mapa en la captura. [Figura móvil](../docs/screenshots/audit/technical-body-sleep-375.png) |
| Consistencia visual | 4 | Estructura y componentes se mantienen entre paneles; la pantalla de importación es densa y extensa en móvil. [Importación móvil](../docs/screenshots/audit/persona-b-05-import-only-personal-375.png) |

**Probable elogio del jurado:** demo sintético claramente separado, explicaciones espaciales accesibles, figura con estados y enfoque local-first. **Probables penalizaciones:** importación como única entrada de mediciones, falta de algunos indicadores y entornos pedidos, recomendaciones médicas generales y el dato de pulso presentado bajo “Blood pressure”.

## Comprobaciones técnicas locales

| Comprobación | Resultado observado |
|---|---|
| Rutas `/body`, `/trends`, `/import`, `/check-in`, `/guides`, `/assistant`, `/research`, `/profiles` | Todas respondieron HTTP 200 en Vite local; con perfil activo, cada ruta y su hard refresh mostraron su pantalla esperada. Sin perfil, la aplicación conduce al onboarding. Esto no demuestra el fallback de un host de producción. |
| Tab antiguo tras redeploy | **No probado**: no hay despliegue ni redeploy de Vercel. |
| HTTPS y cabeceras | **No probado en producción.** El servidor local fue HTTP. Respuesta local observada: `HTTP/1.1 200 OK`, `Vary: Origin`, `Content-Type: text/html`, `Cache-Control: no-cache`, `Etag` presente, `Date` presente, `Connection: keep-alive`, `Keep-Alive: timeout=5`, `Content-Length: 600`. No se observaron `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`. Estas cabeceras son las de Vite local, no las de Vercel. |
| Terceros y consola | No se observaron solicitudes de terceros ni errores de consola en los recorridos automatizados observados. Alcance limitado a esas sesiones; no es una garantía global. |
| Persistencia y aislamiento | El check-in persistió al recargar. Un contexto de navegador nuevo comenzó sin esos datos. `localhost` y `127.0.0.1` quedaron aislados como orígenes distintos. No son pruebas de incógnito real ni de separación entre URLs de producción y preview de Vercel. [Persistencia](../docs/screenshots/audit/production-check-persistence.png), [contexto nuevo](../docs/screenshots/audit/production-check-fresh-context.png), [origen alterno](../docs/screenshots/audit/production-check-origin-alias.png) |
| Privacidad visible | La UI dice que guarda datos en IndexedDB local, que no hay cifrado automático y que perfiles no son autenticación. También dice que la solicitud médica no se conecta con un equipo. No se encontró una declaración explícita de que ningún dato se transmite. [Privacidad y respaldo](../docs/screenshots/audit/persona-a-09-backup.png) |
| Título, favicon y meta description | Título local: `TUMI-HEALT — Astronaut Health Monitoring`. No se encontró enlace de favicon ni meta description. La presencia de título no acredita los metadatos de un despliegue. |
| 375 px | Bienvenida, Body Explorer e importación personal se visualizaron a 375 px; el ancho de contenido probado fue 375 px, sin desbordamiento horizontal. La captura del mapa muestra el menú fijo cubriendo parte de la figura/lista al coincidir con esa zona. [Bienvenida móvil](../docs/screenshots/audit/technical-welcome-375.png), [Body Explorer móvil](../docs/screenshots/audit/technical-body-sleep-375.png), [Importación móvil](../docs/screenshots/audit/persona-b-05-import-only-personal-375.png) |
| Offline después de cargar | El hard reload local sin red falló con `net::ERR_INTERNET_DISCONNECTED`. Es un resultado de Vite local; el comportamiento de Vercel sigue sin probarse. [Antes](../docs/screenshots/audit/offline-before.png), [después](../docs/screenshots/audit/offline-after.png) |
| Lighthouse móvil local | Comando `npx lighthouse` en modo móvil; Welcome, Home y Import se midieron con el contenido correspondiente (perfil vacío para Welcome y perfil de prueba aislado para Home/Import). Resultado real: Welcome `0.49 / 1.00 / 0.96`; Home `0.56 / 1.00 / 0.96`; Import `0.52 / 1.00 / 0.96` para Performance / Accessibility / Best Practices. Aviso repetido: `xlsx.js.map mapping for last column out of bounds: 9:17`. Son puntuaciones locales de desarrollo, no Lighthouse de Vercel. |
| Demo sintético | Sí: en demo aparece “Synthetic example data only. Your personal records are untouched.” [Demo](../docs/screenshots/audit/persona-b-03-demo.png) |

Sin URL de Vercel quedan pendientes: HTTPS, cabeceras de producción, redeploy/chunks, diferencias production/preview, rendimiento y auditoría Lighthouse del hosting real, y funcionamiento offline en producción.

## Diez problemas prioritarios

| # | Problema y evidencia | Cambio sugerido | Esfuerzo |
|---:|---|---|---|
| 1 | La única entrada de mediciones personales es archivo: “Measurements enter the app only by importing a personal time-series file.” [Importación móvil](../docs/screenshots/audit/persona-b-05-import-only-personal-375.png) | Añadir flujo opcional de entrada manual validada o explicar claramente una alternativa de captura; conservar importación por lotes. | Más de medio día |
| 2 | La tarjeta “Blood pressure” presentó `heart_rate` en bpm. [Tendencias](../docs/screenshots/audit/persona-a-07-trends.png) | Corregir el filtro por indicador y añadir una regresión que compruebe etiqueta, unidad y valores. | Medio día |
| 3 | La decisión de escalar carece de criterios operativos visibles; la solicitud queda local. [Solicitud](../docs/screenshots/audit/persona-a-review-request-saved.png) | Mostrar orientación aprobada por el equipo médico del reto o enlazar el protocolo autorizado; no inventar umbrales. | Más de medio día |
| 4 | No se encontró temperatura corporal entre las mediciones aceptadas. [Importación](../docs/screenshots/audit/persona-b-05-import-only.png) | Incorporar indicador y unidades respaldados por el alcance del reto, o declarar explícitamente la limitación. | Medio día |
| 5 | El selector describe gravedad/entorno, pero no los hábitats específicos solicitados. [Contexto de misión](../docs/screenshots/audit/challenge-mission-environments.png) | Representar nave, estación, rover y base de superficie como contextos distintos, sin confundirlos con gravedad. | Medio día |
| 6 | El menú fijo se superpone a contenido del mapa en la vista móvil capturada. [Body Explorer móvil](../docs/screenshots/audit/technical-body-sleep-375.png) | Reservar espacio de desplazamiento inferior y verificar hotspots/lista en viewport real de 375 px. | Menos de 1 hora |
| 7 | El estado de perfil vacío es poco útil antes de cargar datos. [Inicio personal](../docs/screenshots/audit/persona-b-02-home.png) | Ofrecer entrada directa al demo desde el inicio vacío y un primer paso guiado que no parezca depender de archivos. | Medio día |
| 8 | La UI explica IndexedDB y falta de cifrado, pero no afirma claramente si los datos se transmiten o no. [Privacidad](../docs/screenshots/audit/persona-a-09-backup.png) | Añadir una declaración precisa sobre transmisión, validada contra el comportamiento real de red. | Menos de 1 hora |
| 9 | La frecuencia diaria se aplica al check-in, pero no se observó recordatorio para mediciones importadas. [Check-in](../docs/screenshots/audit/persona-a-03-checkin-saved.png) | Añadir una cadencia opcional de autocontrol y distinguir recordatorios de mediciones de los check-ins. | Medio día |
| 10 | El hard reload sin conexión falló en Vite local con `net::ERR_INTERNET_DISCONNECTED`; no hay resultado de producción. [Prueba offline](../docs/screenshots/audit/offline-after.png) | Confirmar si el producto debe funcionar offline; si es requisito, añadir y probar una estrategia de shell/cache en producción. | Más de medio día |

## Guion de prueba con tres personas reales

Realizar con consentimiento, sin datos de salud reales y en un contexto de navegador nuevo por participante. No explicar la navegación por adelantado. Registrar tiempo, clics, errores, frases literales, dudas, tareas abandonadas y capturas sin información personal.

**Participantes sugeridos:** (1) persona con experiencia en operaciones/aviación o salud y poco tiempo; (2) estudiante sin formación médica ni archivos; (3) persona con experiencia clínica o de salud pública que pueda evaluar claridad y límites, sin pedirle validar decisiones médicas.

| Tarea (las cinco para cada participante) | Observar | Preguntar después |
|---|---|---|
| 1. “Mira la primera pantalla durante unos segundos. ¿Para qué crees que sirve? Continúa hasta llegar a algo que consideres útil.” | Comprensión espontánea, tiempo a primer valor, si elige demo o crea perfil, dudas y clics. | “¿Qué esperabas que ocurriera? ¿Qué texto te ayudó o confundió?” |
| 2. “Registra un check-in de hoy con dolor de cabeza y dime qué harías después.” | Encuentra el check-in, diferencia autoinforme de medición, entiende el estado guardado y la orientación. | “¿Qué significa lo que ves? ¿Esperabas recibir una recomendación distinta?” |
| 3. “Usa el archivo de ejemplo proporcionado para importar unas filas; luego prueba el archivo con una fecha inválida.” | Descarga de plantilla, selección de categoría/origen, validación, error, recuperación y confianza en el recuento. | “¿Qué arreglarías? ¿Importarías las filas válidas aunque hubiera una inválida?” |
| 4. “Explora el demo, selecciona sueño y encuentra qué significa el estado y cuándo pedir ayuda.” | Identifica datos sintéticos, significado de puntos/estado, límites diagnósticos y ruta para contacto médico. | “¿Qué acción tomarías? ¿Qué dato o instrucción te falta para decidir?” |
| 5. “Sal del demo, confirma qué perfil está activo, encuentra cómo exportar y dime dónde quedan tus datos.” | Aislamiento demo/perfil, persistencia, respaldo, comprensión de IndexedDB/no cifrado/transmisión. | “¿Qué se comparte o no se comparte? ¿Qué perderías si limpias el navegador?” |

## Diez líneas de veredicto

1. **Estado: listo con correcciones antes de presentar como herramienta de apoyo operativo.**
2. La experiencia educativa y el demo local son comprensibles y el demo está etiquetado como sintético.
3. La figura corporal, las explicaciones espaciales y las etiquetas de estado aportan una base clara para explorar.
4. El perfil vacío no da valor rápido si el visitante no descubre el demo.
5. La importación exclusiva por archivo es la fricción más importante para quien no tiene datos preparados.
6. La tarjeta de presión arterial que muestra `heart_rate` debe corregirse antes de confiar en tendencias.
7. El consejo de contactar al equipo médico no reemplaza criterios de escalamiento aprobados.
8. Faltan temperatura corporal y contextos de nave/estación/rover/base de superficie pedidos por el reto.
9. Lighthouse, offline, cabeceras, HTTPS y actualización de chunks solo se comprobaron parcialmente en local; producción está pendiente.
10. **Veredicto del reto: No, todavía no lo cumple plenamente**, por indicadores y entornos faltantes, límites de orientación y dependencia de archivos.
