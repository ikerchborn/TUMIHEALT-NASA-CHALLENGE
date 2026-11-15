# Informe de Fase 10 — importación y seguridad de archivos

## Decisión sobre SheetJS

Se actualizará el `xlsx` existente desde npm `0.18.5` al tarball oficial `xlsx@0.20.3` distribuido por SheetJS, en lugar de deshabilitar XLSX. La importación personal de Excel es un formato existente que el reto solicita conservar; la actualización cubre los dos avisos verificados y evita reemplazar la función con código propio.

- Versión de instalación: `0.20.3`, URL oficial: <https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz>.
- Licencia: Apache-2.0, identificada por la página oficial del [CDN de SheetJS](https://cdn.sheetjs.com/).
- Motivo: la versión npm instalada `0.18.5` está afectada por Prototype Pollution (CVE-2023-30533) y ReDoS (CVE-2024-22363). SheetJS indica que los paquetes npm están desactualizados y que los releases corregidos se distribuyen en su CDN.
- Fuentes oficiales: [aviso CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [aviso CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363) e [instrucciones de instalación Node.js](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

Este paquete se compila localmente con la aplicación; no introduce solicitudes de red en tiempo de ejecución.

## Auditoría previa

`npm audit` antes de actualizar `xlsx` informó 4 vulnerabilidades (1 moderada, 1 alta y 2 críticas). Los hallazgos de `@vitest/mocker` y `tinypool` son dependencias de desarrollo y quedan documentados sin forzar la actualización mayor de Vitest.

Los avisos de SheetJS fueron verificados en las fuentes oficiales: Prototype Pollution afecta hasta `0.19.2` (CVE-2023-30533) y ReDoS afecta hasta `0.20.1` (CVE-2024-22363). El aviso de GitHub no publica una versión parcheada por npm; el fabricante distribuye las versiones parcheadas desde su CDN. Se instaló la versión oficial `0.20.3`.

## Matriz de fallos de importación

| Clase | Fixture | Prueba | Mensaje/localización comprobados |
| --- | --- | --- | --- |
| Extensión no admitida | `unsupported.txt` | `unsupported extension reports file location and supported upload formats` | Nombre de archivo, `file-level`, tipo no admitido y formatos CSV/XML/XLSX |
| Archivo vacío | buffer vacío como `empty.csv` | `zero-byte file reports the file and a non-empty upload recommendation` | Nombre, `file-level`, vacío y recomendación de archivo no vacío |
| Tamaño excesivo | buffer de 5 MiB + 1 como `oversized.csv` | `file above 5 MiB is rejected before parsing` | Nombre, `file-level`, límite 5 MiB y archivo menor |
| UTF-8 no legible | bytes UTF-8 inválidos como `invalid-encoding.csv` | `invalid UTF-8 bytes identify the unreadable file and supported text formats` | Nombre, `file-level`, UTF-8 y alternativas |
| Delimitador incorrecto | `semicolon.csv` | `alternate CSV delimiter points to the header row and requests comma-separated CSV` | Cabecera CSV, fila 1, delimitador y re-guardado como CSV separado por comas |
| XML mal formado | `malformed.xml` | `malformed XML reports the parser line and asks for a corrected XML template` | Línea XML detectada por Chromium y recomendación XML/CSV |
| DTD y entidad externa | `xxe.xml` | `external-entity XML is rejected in Chromium without making its external request` | Línea 2, rechazo DTD/entity; cero solicitudes al URL externo |
| XML anidado excesivamente | XML profundo generado en la prueba | `deeply nested XML is rejected by the depth limit in Chromium` | Línea XML, límite de 32 niveles y plantilla recomendada |
| Columnas requeridas ausentes | `missing-columns.csv` | `missing CSV columns identify the header and recommend a TUMI-HEALT template` | Cabecera CSV, fila 1 y plantilla |
| Elemento XML requerido ausente | `missing-element.xml` | `missing XML elements identify the row and source line` | Fila 2, línea XML 2, `<unit>` y plantilla |
| Indicador desconocido | `unknown-indicator.csv` | `unknown indicator identifies its row and lists supported indicators` | Fila 2 y lista de indicadores de sangre admitidos |
| Unidad no admitida | `unsupported-unit.csv` | `unit errors identify their row and list accepted units` | Fila 2 y unidad aceptada `bpm` |
| Valor inválido | `invalid-value.csv` | `invalid numeric value identifies its row and corrected upload format` | Fila 2, valor no numérico y plantilla |
| Fecha inválida | `invalid-date.csv` | `invalid date identifies its row and corrected upload format` | Fila 2 y requisito ISO-8601 |
| Fecha futura | `future-date.csv` | `future date identifies its row and corrected upload format` | Fila 2 y rechazo de fecha futura |
| Duplicado | `duplicate.csv` importado dos veces | `duplicate import identifies the file and directs the user to history` | Archivo, `file-level`, lote duplicado e indicación de Historial |
| XLSX sin hoja de datos | Libro `Empty` generado en prueba | `XLSX workbook without a data sheet reports the workbook location and alternative` | Ubicación del libro, 0 hojas de datos legibles y CSV/XML |
| XLSX con celdas combinadas | Hoja `Measurements` generada con `A1:B1` combinado | `XLSX merged cells report worksheet range and remediation` | Hoja y rango `A1:B1`; instrucción para descombinar |
| XLSX con fórmula sin caché | Hoja generada con fórmula `C2` sin resultado | `XLSX formula without a cached value reports worksheet cell and remediation` | Hoja, celda `C2` e instrucción de guardar valores calculados |

También se probaron en Chromium los encabezados CSV/XLSX y elementos XML `__proto__`, `constructor` y `prototype`: se rechazan con una ubicación normal y no agregan propiedades a `Object.prototype`. `exportRecordsToSafeCsv` se probó con celdas que empiezan por `=`, `+`, `-` y `@`.

La prueba `CSV, XML, and XLSX templates downloaded from the app complete the browser import flow` descargó cada plantilla desde la UI, la volvió a cargar en Chromium, validó y confirmó una medición.

## Resultados

- `npx playwright test tests/e2e/phase10-import-security.spec.ts` — **23 pruebas aprobadas** en Chromium.
- `npm test -- --run` — **14 archivos, 67 pruebas aprobadas**.
- `npm run typecheck` — aprobado.
- `npm run build` — aprobado; entry principal **138.65 kB**, spreadsheet **492.01 kB**, charts **381.16 kB**; ningún chunk supera 500 kB.
- `npm audit` antes: **4 hallazgos** (moderado 1, alto 1, crítico 2); incluye `xlsx` 0.18.5 y dependencias de desarrollo Vitest/Tinypool.
- `npm audit` después: **3 hallazgos**, exclusivamente en `@vitest/mocker`/Vitest y Tinypool; el audit estándar ya no lista `xlsx` 0.20.3.
- `npm audit --omit=dev` después: **0 vulnerabilidades**.
- `npm ls xlsx --depth=0` y metadatos instalados: `xlsx@0.20.3`, Apache-2.0.
- `git diff --check` — aprobado.

No se forzó Vitest 5.1.0: el fix de npm implica cambio mayor y el prompt pide dejar documentados los avisos dev-only.

## Archivos de esta fase

Modificados: `package.json`, `package-lock.json`, `src/app/pages/ImportPage.tsx`, `src/services/ingestion/csvParser.ts`, `src/services/ingestion/xmlMeasurementAdapter.ts`, `src/services/security/securityService.ts`, `src/services/dataEngineering/etl/spreadsheetAdapter.ts`, `tests/unit/phase4-import-formats.test.ts`, `tests/integration/csv-import.test.ts`.

Creados: `tests/e2e/phase10-import-security.spec.ts` y `tests/e2e/fixtures/import/` (fixtures CSV/XML/texto usados en la matriz).

## No realizado / decisiones abiertas

- Los avisos dev-only de Vitest/Tinypool siguen abiertos; la aplicación no tiene vulnerabilidades en dependencias de producción según `npm audit --omit=dev`.
- No se forzó una actualización mayor de Vitest.
