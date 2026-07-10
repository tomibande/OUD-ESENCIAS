# Oud & Esencias — Frontend

Plataforma de e-commerce de perfumería árabe. Proyecto académico (6to año,
Modalidad Técnica / Informática) desarrollado bajo metodología ágil Scrum.

Este repositorio contiene el **Frontend** completo, construido según la
arquitectura definida en la documentación del proyecto:
**HTML5 + CSS3 + TypeScript**, sin frameworks ni bundlers.

## Estructura

```
frontend/
├── index.html        # Catálogo público: buscador, filtros, carrito, checkout
├── login.html         # Inicio de sesión (cliente / administrador)
├── registro.html       # Alta de cuenta de cliente
├── admin.html          # Backoffice: alta y baja de perfumes
├── css/
│   ├── global.css      # Design tokens, navbar, footer, botones, carrito, modal
│   ├── tienda.css       # Hero, filtros y grilla del catálogo
│   ├── auth.css         # Login / registro
│   └── admin.css        # Panel administrativo
├── src/                 # Código fuente TypeScript
│   ├── types.ts          # Modelos compartidos (Perfume, Usuario, Pedido…)
│   ├── api.ts             # Capa de datos (ver nota abajo)
│   ├── app.ts              # Navbar, sesión, utilidades compartidas
│   ├── auth.ts              # Login y registro
│   ├── catalogo.ts           # Catálogo, filtros, buscador
│   ├── carrito.ts             # Carrito, cupones, checkout, historial
│   └── admin.ts                # Alta / baja de perfumes
├── dist/                 # JavaScript compilado (generado con `tsc`)
├── data/perfumes.json     # Datos semilla del catálogo
└── tsconfig.json
```

## Cómo probarlo

No requiere instalación de dependencias para verlo funcionando:

```bash
cd frontend
python3 -m http.server 8080
# abrir http://localhost:8080/index.html
```

Cuenta de administrador de prueba: `admin@oudesencias.com` / `admin1234`

## Sobre la capa de datos (`src/api.ts`)

El Backend (TypeScript + Node/Express + SQLite) todavía no expone endpoints
estables. Para no bloquear el desarrollo de interfaz, `api.ts` **simula**
el comportamiento del servidor (persistencia en `localStorage`, usando
`data/perfumes.json` como semilla) respetando exactamente los mismos
contratos que va a tener la API real (mismos nombres de función, misma
forma de los datos, mismas reglas de negocio: validación de stock,
cupones, baja lógica, checkout atómico, etc.).

**Cuando el backend esté listo**, alcanza con reemplazar el cuerpo de cada
función de `api.ts` por un `fetch("/api/...")` correspondiente — el resto
del frontend (`catalogo.ts`, `carrito.ts`, `admin.ts`, `auth.ts`) no
necesita modificarse porque solo dependen de esas firmas.

## Recompilar TypeScript

```bash
cd frontend
npx tsc
```

Esto regenera `dist/*.js` a partir de `src/*.ts`.

## Requerimientos funcionales cubiertos

| RF | Cubierto en |
|----|-------------|
| RF-01, RF-02, RF-03, RF-04 | `auth.ts`, `app.ts` |
| RF-05, RF-06, RF-07 | `catalogo.ts` |
| RF-08, RF-09, RF-10 | `carrito.ts` |
| RF-11, RF-17 | `carrito.ts` (cupones) |
| RF-12, RF-13 | `carrito.ts` (checkout) |
| RF-14, RF-15, RF-16 | `admin.ts` |
| RF-18 | `carrito.ts` (modal "Mis pedidos") |

RNF-01 (responsivo), RNF-09 (mensajes de error claros) y RNF-06 (checkout
atómico, simulado del lado del cliente) también están contemplados.
