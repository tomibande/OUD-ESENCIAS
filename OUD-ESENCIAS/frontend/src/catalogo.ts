/**
 * catalogo.ts
 * Controla index.html: grilla de productos, buscador y filtros
 * concurrentes (marca, notas olfativas, rango de precio).
 * RF-05 a RF-09, HU-03, HU-04, HU-05.
 */

import type { Perfume, FiltrosCatalogo } from "./types.js";
import { obtenerCatalogoPublico, obtenerMarcasDisponibles, obtenerNotasDisponibles, obtenerSesionActual } from "./api.js";
import { formatoMoneda, escaparHtml } from "./app.js";
import { agregarAlCarrito } from "./carrito.js";

/** SVG de respaldo cuando la imagen del perfume no carga (sin conexión, CDN caída, etc.). */
const IMAGEN_RESPALDO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#1c1712"/><text x="50%" y="50%" fill="#a9895f" font-family="sans-serif" font-size="16" text-anchor="middle" dominant-baseline="middle">Oud Esencias</text></svg>`
  );

let catalogoCompleto: Perfume[] = [];

const filtrosActuales: FiltrosCatalogo = {
  busqueda: "",
  marca: "",
  notaOlfativa: "",
  precioMin: null,
  precioMax: null,
};

function aplicarFiltros(): Perfume[] {
  return catalogoCompleto.filter((p) => {
    const coincideBusqueda =
      !filtrosActuales.busqueda ||
      p.nombre.toLowerCase().includes(filtrosActuales.busqueda) ||
      p.marca.toLowerCase().includes(filtrosActuales.busqueda) ||
      p.familiaOlfativa.toLowerCase().includes(filtrosActuales.busqueda);

    const coincideMarca = !filtrosActuales.marca || p.marca === filtrosActuales.marca;
    const coincideNota = !filtrosActuales.notaOlfativa || p.familiaOlfativa === filtrosActuales.notaOlfativa;
    const coincideMin = filtrosActuales.precioMin === null || p.precio >= filtrosActuales.precioMin;
    const coincideMax = filtrosActuales.precioMax === null || p.precio <= filtrosActuales.precioMax;

    return coincideBusqueda && coincideMarca && coincideNota && coincideMin && coincideMax;
  });
}

function tarjetaPerfume(perfume: Perfume): string {
  const sesion = obtenerSesionActual();

  // RF: el botón "Añadir al carrito" sólo se muestra a usuarios con sesión
  // iniciada. Si no hay sesión, se invita a iniciarla en su lugar.
  const accionCarrito = sesion
    ? `<button type="button" class="btn btn--dorado btn--sm" data-agregar-carrito="${perfume.id}">
        Añadir al carrito
      </button>`
    : `<a href="login.html" class="btn btn--linea btn--sm" data-requiere-login>
        Iniciá sesión para comprar
      </a>`;

  return `
    <article class="tarjeta-perfume" data-id="${perfume.id}">
      <div class="tarjeta-perfume__cara tarjeta-perfume__cara--frente">
        <div class="tarjeta-perfume__imagen-wrap">
          <img
            src="${escaparHtml(perfume.imagen)}"
            alt="${escaparHtml(perfume.nombre)}"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='${IMAGEN_RESPALDO}';"
          >
          <span class="tarjeta-perfume__familia">${escaparHtml(perfume.familiaOlfativa)}</span>
        </div>
        <div class="tarjeta-perfume__cuerpo">
          <p class="tarjeta-perfume__marca">${escaparHtml(perfume.marca)}</p>
          <h3 class="tarjeta-perfume__nombre">${escaparHtml(perfume.nombre)}</h3>
          <p class="tarjeta-perfume__ml">${perfume.ml} ml</p>
          <div class="tarjeta-perfume__pie">
            <span class="tarjeta-perfume__precio">${formatoMoneda(perfume.precio)}</span>
            ${accionCarrito}
          </div>
          <button type="button" class="tarjeta-perfume__ver-piramide" data-ver-piramide="${perfume.id}">
            Ver pirámide olfativa ↴
          </button>
        </div>
      </div>
      <div class="tarjeta-perfume__piramide" data-piramide="${perfume.id}" hidden>
        ${piramideHtml(perfume)}
      </div>
    </article>
  `;
}

function piramideHtml(perfume: Perfume): string {
  const nivel = (etiqueta: string, notas: string[], mod: string) => `
    <div class="piramide__nivel piramide__nivel--${mod}">
      <span class="piramide__etiqueta">${etiqueta}</span>
      <div class="piramide__barra"><span></span></div>
      <p class="piramide__notas">${notas.map(escaparHtml).join(" · ")}</p>
    </div>
  `;
  return `
    <button type="button" class="tarjeta-perfume__cerrar-piramide" data-cerrar-piramide="${perfume.id}" aria-label="Cerrar">✕</button>
    <h4 class="piramide__titulo">Pirámide Olfativa</h4>
    <p class="piramide__descripcion">${escaparHtml(perfume.descripcion)}</p>
    ${nivel("Salida", perfume.piramide.salida, "salida")}
    ${nivel("Corazón", perfume.piramide.corazon, "corazon")}
    ${nivel("Fondo", perfume.piramide.fondo, "fondo")}
  `;
}

function renderizarGrilla(): void {
  const grilla = document.querySelector<HTMLElement>("[data-grilla-catalogo]");
  const vacio = document.querySelector<HTMLElement>("[data-catalogo-vacio]");
  const contador = document.querySelector<HTMLElement>("[data-contador-resultados]");
  if (!grilla) return;

  const resultados = aplicarFiltros();

  if (contador) {
    contador.textContent = `${resultados.length} ${resultados.length === 1 ? "fragancia" : "fragancias"}`;
  }

  if (resultados.length === 0) {
    grilla.innerHTML = "";
    if (vacio) vacio.hidden = false;
    return;
  }
  if (vacio) vacio.hidden = true;

  grilla.innerHTML = resultados.map(tarjetaPerfume).join("");
}

function inicializarInteracciones(): void {
  const grilla = document.querySelector<HTMLElement>("[data-grilla-catalogo]");
  if (!grilla) return;

  grilla.addEventListener("click", async (evento) => {
    const objetivo = evento.target as HTMLElement;

    const idAgregar = objetivo.closest<HTMLElement>("[data-agregar-carrito]")?.dataset.agregarCarrito;
    if (idAgregar) {
      let error: string | null;
      try {
        error = await agregarAlCarrito(Number(idAgregar));
      } catch (e) {
        // Antes, si agregarAlCarrito() rechazaba la promesa (p. ej. porque la
        // base simulada no pudo inicializarse), el error quedaba sin capturar:
        // el botón "Añadir" no mostraba nada y parecía que no hacía nada.
        console.error("Error inesperado al agregar al carrito:", e);
        error = "No se pudo agregar el perfume al carrito. Probá recargar la página.";
      }
      const toastContenedor = document.querySelector("[data-toasts]");
      if (toastContenedor) {
        const toast = document.createElement("div");
        toast.className = `toast toast--${error ? "error" : "exito"} toast--visible`;
        toast.textContent = error ?? "Se añadió al carrito.";
        toastContenedor.appendChild(toast);
        setTimeout(() => toast.remove(), 2600);
      }
      return;
    }

    const idPiramide = objetivo.closest<HTMLElement>("[data-ver-piramide]")?.dataset.verPiramide;
    if (idPiramide) {
      document.querySelector(`[data-piramide="${idPiramide}"]`)?.removeAttribute("hidden");
      return;
    }

    const idCerrarPiramide = objetivo.closest<HTMLElement>("[data-cerrar-piramide]")?.dataset.cerrarPiramide;
    if (idCerrarPiramide) {
      document.querySelector(`[data-piramide="${idCerrarPiramide}"]`)?.setAttribute("hidden", "");
    }
  });
}

async function poblarFiltros(): Promise<void> {
  const selectMarca = document.querySelector<HTMLSelectElement>("[data-filtro-marca]");
  const selectNota = document.querySelector<HTMLSelectElement>("[data-filtro-nota]");

  const [marcas, notas] = await Promise.all([obtenerMarcasDisponibles(), obtenerNotasDisponibles()]);

  if (selectMarca) {
    for (const marca of marcas) {
      const opcion = document.createElement("option");
      opcion.value = marca;
      opcion.textContent = marca;
      selectMarca.appendChild(opcion);
    }
  }
  if (selectNota) {
    for (const nota of notas) {
      const opcion = document.createElement("option");
      opcion.value = nota;
      opcion.textContent = nota;
      selectNota.appendChild(opcion);
    }
  }
}

function inicializarControlesFiltro(): void {
  document.querySelector<HTMLInputElement>("[data-filtro-busqueda]")?.addEventListener("input", (e) => {
    filtrosActuales.busqueda = (e.target as HTMLInputElement).value.trim().toLowerCase();
    renderizarGrilla();
  });

  document.querySelector<HTMLSelectElement>("[data-filtro-marca]")?.addEventListener("change", (e) => {
    filtrosActuales.marca = (e.target as HTMLSelectElement).value;
    renderizarGrilla();
  });

  document.querySelector<HTMLSelectElement>("[data-filtro-nota]")?.addEventListener("change", (e) => {
    filtrosActuales.notaOlfativa = (e.target as HTMLSelectElement).value;
    renderizarGrilla();
  });

  document.querySelector<HTMLInputElement>("[data-filtro-precio-min]")?.addEventListener("input", (e) => {
    const valor = (e.target as HTMLInputElement).value;
    filtrosActuales.precioMin = valor ? Number(valor) : null;
    renderizarGrilla();
  });

  document.querySelector<HTMLInputElement>("[data-filtro-precio-max]")?.addEventListener("input", (e) => {
    const valor = (e.target as HTMLInputElement).value;
    filtrosActuales.precioMax = valor ? Number(valor) : null;
    renderizarGrilla();
  });

  document.querySelector("[data-limpiar-filtros]")?.addEventListener("click", () => {
    filtrosActuales.busqueda = "";
    filtrosActuales.marca = "";
    filtrosActuales.notaOlfativa = "";
    filtrosActuales.precioMin = null;
    filtrosActuales.precioMax = null;

    const formulario = document.querySelector<HTMLFormElement>("[data-form-filtros]");
    formulario?.reset();
    renderizarGrilla();
  });

  document.querySelector<HTMLButtonElement>("[data-toggle-filtros]")?.addEventListener("click", (e) => {
    const panel = document.querySelector("[data-panel-filtros]");
    const abierto = panel?.classList.toggle("filtros--abierto");
    (e.currentTarget as HTMLButtonElement).setAttribute("aria-expanded", String(Boolean(abierto)));
  });
}

async function inicializarCatalogo(): Promise<void> {
  const grilla = document.querySelector<HTMLElement>("[data-grilla-catalogo]");
  if (!grilla) return;

  try {
    catalogoCompleto = await obtenerCatalogoPublico();
    await poblarFiltros();
    inicializarControlesFiltro();
    inicializarInteracciones();
    renderizarGrilla();
  } catch (error) {
    // Antes, si obtenerCatalogoPublico() fallaba (p. ej. no se pudo cargar
    // data/perfumes.json), la excepción quedaba sin manejar y la grilla se
    // quedaba vacía para siempre, sin ningún mensaje visible para el usuario.
    console.error("No se pudo cargar el catálogo:", error);
    const vacio = document.querySelector<HTMLElement>("[data-catalogo-vacio]");
    if (vacio) {
      vacio.querySelector("h3")!.textContent = "No pudimos cargar el catálogo";
      vacio.querySelector("p")!.textContent =
        "Ocurrió un problema al cargar los perfumes. Recargá la página o probá más tarde.";
      vacio.hidden = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", inicializarCatalogo);
