# Informe de Fase 9 — seguridad base y Welcome

## Evidencia visual

Antes del cambio, abrí `/welcome` en navegador a 375, 768 y 1440 px. En las tres vistas el área visual contenía un círculo vacío con brillo cian y dos líneas de texto; no mostraba una figura anatómica, SVG ni canvas. A 375 y 768 px el contenido se apilaba en una columna; a 1440 px se distribuía en dos columnas.

Welcome ahora reutiliza la misma ilustración anatómica SVG que Body Explorer mediante `BodyIllustration`. Es estática, conserva un brillo sutil, no carga geometría 3D y no depende de animaciones. Se mantuvo la acción principal “Get Started”. Se guardaron capturas full-page a 375, 768 y 1440 px en `docs/screenshots/welcome-*.png`.

## Comprobaciones y cambios

- `.gitignore` cubre `node_modules/`, `dist/`, `test-results/` y `playwright-report/`; `git check-ignore -v` confirmó los cuatro patrones.
- La búsqueda de imports/usos de Three.js en `src/` no encontró referencias. Se quitaron `three`, `@types/three` y la regla de chunk manual `three-vendor`; `npm ls three @types/three --depth=0` quedó vacío.
- `BodyExplorerPage` conserva la selección de región y teclado con la ilustración compartida.
- El test de Welcome verifica la ilustración accesible, ausencia de canvas, la acción “Get Started” y genera las tres capturas.

## Comandos ejecutados

| Comando | Resultado observado |
| --- | --- |
| `git switch -c ux-redesign` | Rama creada |
| `git add -A` + `git commit -m "chore: establish ux redesign baseline"` | Commit `ebbe22fcf9ade2c37d9e5ea5a69b2020e153b451`; 95 archivos, 13,262 inserciones y 708 eliminaciones |
| `npm uninstall three @types/three` | Eliminó 8 paquetes; npm indicó 4 vulnerabilidades restantes |
| `npm run typecheck` | Aprobado |
| `npm run qa:screenshots -- --grep "required viewport screenshots" --grep "Welcome shows"` | 1 test aprobado; capturas de Welcome generadas |
| `npx playwright test tests/e2e/phase8-qa.spec.ts --grep "Body Explorer selection"` | 1 test aprobado |
| `npm run build` | Aprobado; ningún chunk supera 500 kB |
| `npm ls three @types/three --depth=0` | `(empty)` |
| `git diff --check` | Aprobado |
| `git check-ignore -v node_modules/phase9-check dist/phase9-check test-results/phase9-check playwright-report/phase9-check` | Los cuatro patrones fueron confirmados |

El baseline se creó en `ux-redesign` antes de los cambios de esta fase. El árbol estaba limpio inmediatamente después del commit. Los cambios de Fase 9 posteriores permanecen en el worktree.

## Alcance no cubierto y decisiones abiertas

- No se añadió un modelo 3D ni una dependencia; el prompt indica que no hay un recurso 3D licenciado disponible.
- No se ejecutó aquí el conjunto E2E completo; las pruebas específicas de Welcome y Body Explorer sí pasaron. La QA integral queda para la Fase 13.
- No hay decisiones abiertas para completar esta fase. Los cuatro hallazgos de `npm audit` requieren análisis en la Fase 10.
