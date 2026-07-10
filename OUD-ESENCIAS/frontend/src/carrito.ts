/**
 * carrito.ts
 * Gestión del carrito de compras, cupones, checkout e historial de
 * pedidos. RF-08 a RF-13, RF-17, RF-18, HU-05 a HU-08, HU-14.
 *
 * El carrito persiste en localStorage (independiente de la sesión) para
 * que el visitante no pierda su selección al recargar la página.
 */

import type { ItemCarrito, Perfume } from "./types.js";
import {
  obtenerPerfumePorId,
  obtenerCatalogoPublico,
  validarCupon,
  procesarCheckout,
  obtenerHistorialPedidos,
  obtenerSesionActual,
} from "./api.js";
import { formatoMoneda, escaparHtml } from "./app.js";

const CARRITO_KEY = "oud_carrito";

function leerCarrito(): ItemCarrito[] {
  const guardado = localStorage.getItem(CARRITO_KEY);
  return guardado ? (JSON.parse(guardado) as ItemCarrito[]) : [];
}

function guardarCarrito(items: ItemCarrito[]): void {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(items));
  actualizarBadge();
  document.dispatchEvent(new CustomEvent("carrito:actualizado"));
}

function actualizarBadge(): void {
  const badge = document.querySelector<HTMLElement>("[data-badge-carrito]");
  if (!badge) return;
  const cantidad = leerCarrito().reduce((acc, i) => acc + i.cantidad, 0);
  badge.textContent = String(cantidad);
  badge.hidden = cantidad === 0;
}

/**
 * Agrega un perfume al carrito respetando el límite de stock real (RF-09).
 * Devuelve un mensaje de error si no se pudo agregar, o null si fue exitoso.
 */
export async function agregarAlCarrito(perfumeId: number, cantidadDeseada = 1): Promise<string | null> {
  const perfume = await obtenerPerfumePorId(perfumeId);
  if (!perfume || !perfume.activo) return "Ese perfume ya no está disponible.";

  const items = leerCarrito();
  const existente = items.find((i) => i.perfumeId === perfumeId);
  const cantidadTotal = (existente?.cantidad ?? 0) + cantidadDeseada;

  if (cantidadTotal > perfume.stock) {
    return `Solo quedan ${perfume.stock} unidades de "${perfume.nombre}" en stock.`;
  }

  if (existente) {
    existente.cantidad = cantidadTotal;
  } else {
    items.push({ perfumeId, cantidad: cantidadDeseada });
  }

  guardarCarrito(items);
  return null;
}

export async function actualizarCantidad(perfumeId: number, nuevaCantidad: number): Promise<string | null> {
  const perfume = await obtenerPerfumePorId(perfumeId);
  if (!perfume) return "Ese perfume ya no está disponible.";

  const items = leerCarrito();
  const item = items.find((i) => i.perfumeId === perfumeId);
  if (!item) return null;

  if (nuevaCantidad <= 0) {
    guardarCarrito(items.filter((i) => i.perfumeId !== perfumeId));
    return null;
  }

  if (nuevaCantidad > perfume.stock) {
    return `Solo quedan ${perfume.stock} unidades disponibles.`;
  }

  item.cantidad = nuevaCantidad;
  guardarCarrito(items);
  return null;
}

export function quitarDelCarrito(perfumeId: number): void {
  guardarCarrito(leerCarrito().filter((i) => i.perfumeId !== perfumeId));
}

function vaciarCarrito(): void {
  guardarCarrito([]);
}

/* ---------------------------------------------------------------------- */
/* Renderizado del panel lateral del carrito                              */
/* ---------------------------------------------------------------------- */

let cuponAplicado: { codigo: string; porcentaje: number } | null = null;

async function renderizarCarrito(): Promise<void> {
  const lista = document.querySelector<HTMLElement>("[data-lista-carrito]");
  const vacio = document.querySelector<HTMLElement>("[data-carrito-vacio]");
  const totalesEl = document.querySelector<HTMLElement>("[data-carrito-totales]");
  if (!lista) return;

  const items = leerCarrito();
  lista.innerHTML = "";

  if (items.length === 0) {
    if (vacio) vacio.hidden = false;
    if (totalesEl) totalesEl.hidden = true;
    return;
  }
  if (vacio) vacio.hidden = true;
  if (totalesEl) totalesEl.hidden = false;

  let subtotal = 0;

  for (const item of items) {
    const perfume = await obtenerPerfumePorId(item.perfumeId);
    if (!perfume) continue;
    const sublineaTotal = perfume.precio * item.cantidad;
    subtotal += sublineaTotal;

    const fila = document.createElement("li");
    fila.className = "carrito-item";
    fila.innerHTML = `
      <img class="carrito-item__imagen" src="${escaparHtml(perfume.imagen)}" alt="${escaparHtml(perfume.nombre)}" loading="lazy">
      <div class="carrito-item__info">
        <p class="carrito-item__nombre">${escaparHtml(perfume.nombre)}</p>
        <p class="carrito-item__marca">${escaparHtml(perfume.marca)} · ${perfume.ml} ml</p>
        <div class="carrito-item__acciones">
          <div class="stepper" data-stepper>
            <button type="button" class="stepper__btn" data-restar aria-label="Restar unidad">−</button>
            <span class="stepper__valor">${item.cantidad}</span>
            <button type="button" class="stepper__btn" data-sumar aria-label="Sumar unidad">+</button>
          </div>
          <button type="button" class="carrito-item__quitar" data-quitar>Quitar</button>
        </div>
      </div>
      <p class="carrito-item__subtotal">${formatoMoneda(sublineaTotal)}</p>
    `;

    fila.querySelector("[data-sumar]")?.addEventListener("click", async () => {
      const error = await actualizarCantidad(perfume.id, item.cantidad + 1);
      if (error) mostrarToast(error, "error");
      renderizarCarrito();
    });
    fila.querySelector("[data-restar]")?.addEventListener("click", async () => {
      await actualizarCantidad(perfume.id, item.cantidad - 1);
      renderizarCarrito();
    });
    fila.querySelector("[data-quitar]")?.addEventListener("click", () => {
      quitarDelCarrito(perfume.id);
      renderizarCarrito();
    });

    lista.appendChild(fila);
  }

  const descuento = cuponAplicado ? Math.round(subtotal * (cuponAplicado.porcentaje / 100)) : 0;
  const total = subtotal - descuento;

  if (totalesEl) {
    totalesEl.innerHTML = `
      <div class="carrito-totales__fila">
        <span>Subtotal</span><span>${formatoMoneda(subtotal)}</span>
      </div>
      ${
        cuponAplicado
          ? `<div class="carrito-totales__fila carrito-totales__fila--descuento">
               <span>Cupón ${escaparHtml(cuponAplicado.codigo)} (−${cuponAplicado.porcentaje}%)</span>
               <span>−${formatoMoneda(descuento)}</span>
             </div>`
          : ""
      }
      <div class="carrito-totales__fila carrito-totales__fila--total">
        <span>Total</span><span>${formatoMoneda(total)}</span>
      </div>
    `;
  }
}

function mostrarToast(mensaje: string, tipo: "exito" | "error" = "exito"): void {
  const contenedor = document.querySelector<HTMLElement>("[data-toasts]");
  if (!contenedor) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ---------------------------------------------------------------------- */
/* Cupón + Checkout                                                       */
/* ---------------------------------------------------------------------- */

function inicializarCupon(): void {
  const formulario = document.querySelector<HTMLFormElement>("[data-form-cupon]");
  if (!formulario) return;
  const mensaje = formulario.querySelector<HTMLElement>("[data-cupon-mensaje]")!;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const sesion = obtenerSesionActual();
    if (!sesion) {
      mensaje.textContent = "Iniciá sesión para aplicar un cupón.";
      mensaje.className = "cupon-mensaje cupon-mensaje--error";
      return;
    }
    const input = formulario.elements.namedItem("codigoCupon") as HTMLInputElement;
    const resultado = await validarCupon(input.value.trim(), sesion.usuario.id);

    if (!resultado.valido || !resultado.cupon) {
      cuponAplicado = null;
      mensaje.textContent = resultado.motivo ?? "Cupón inválido.";
      mensaje.className = "cupon-mensaje cupon-mensaje--error";
    } else {
      cuponAplicado = { codigo: resultado.cupon.codigo, porcentaje: resultado.cupon.porcentaje };
      mensaje.textContent = `Cupón aplicado: ${resultado.cupon.porcentaje}% de descuento.`;
      mensaje.className = "cupon-mensaje cupon-mensaje--exito";
    }
    renderizarCarrito();
  });
}

function inicializarCheckout(): void {
  const boton = document.querySelector<HTMLButtonElement>("[data-boton-checkout]");
  if (!boton) return;

  boton.addEventListener("click", async () => {
    const sesion = obtenerSesionActual();
    if (!sesion) {
      window.location.href = "login.html";
      return;
    }

    const items = leerCarrito();
    if (items.length === 0) return;

    boton.disabled = true;
    boton.textContent = "Procesando pago…";

    try {
      const pedido = await procesarCheckout({
        usuarioId: sesion.usuario.id,
        items,
        codigoCupon: cuponAplicado?.codigo ?? null,
      });
      vaciarCarrito();
      cuponAplicado = null;
      renderizarCarrito();
      mostrarToast(`¡Compra aprobada! N.º de orden ${pedido.id}.`, "exito");
      cerrarPanelCarrito();
    } catch (error) {
      mostrarToast(error instanceof Error ? error.message : "No se pudo procesar el pago.", "error");
    } finally {
      boton.disabled = false;
      boton.textContent = "Confirmar compra";
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Apertura / cierre del panel lateral                                    */
/* ---------------------------------------------------------------------- */

function abrirPanelCarrito(): void {
  document.querySelector("[data-panel-carrito]")?.classList.add("panel-lateral--abierto");
  document.querySelector("[data-overlay]")?.classList.add("overlay--visible");
  renderizarCarrito();
}

function cerrarPanelCarrito(): void {
  document.querySelector("[data-panel-carrito]")?.classList.remove("panel-lateral--abierto");
  document.querySelector("[data-overlay]")?.classList.remove("overlay--visible");
}

/* ---------------------------------------------------------------------- */
/* Historial de pedidos (RF-18)                                           */
/* ---------------------------------------------------------------------- */

async function abrirModalPedidos(): Promise<void> {
  const sesion = obtenerSesionActual();
  const modal = document.querySelector<HTMLElement>("[data-modal-pedidos]");
  const listaPedidos = document.querySelector<HTMLElement>("[data-lista-pedidos]");
  if (!sesion || !modal || !listaPedidos) return;

  const pedidos = await obtenerHistorialPedidos(sesion.usuario.id);
  listaPedidos.innerHTML = pedidos.length
    ? ""
    : `<p class="texto-muted">Todavía no realizaste ninguna compra.</p>`;

  for (const pedido of pedidos) {
    const fecha = new Date(pedido.fecha).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const item = document.createElement("article");
    item.className = "pedido-card";
    item.innerHTML = `
      <header class="pedido-card__header">
        <div>
          <p class="pedido-card__id">Orden ${escaparHtml(pedido.id)}</p>
          <p class="pedido-card__fecha">${fecha}</p>
        </div>
        <span class="etiqueta-estado etiqueta-estado--${pedido.estadoEnvio.replace(/\s/g, "-")}">${pedido.estadoEnvio}</span>
      </header>
      <ul class="pedido-card__lineas">
        ${pedido.lineas
          .map(
            (l) =>
              `<li>${l.cantidad} × ${escaparHtml(l.nombre)} <span>${formatoMoneda(l.subtotal)}</span></li>`
          )
          .join("")}
      </ul>
      <footer class="pedido-card__footer">
        ${pedido.cuponAplicado ? `<span>Cupón: ${escaparHtml(pedido.cuponAplicado)}</span>` : "<span></span>"}
        <strong>Total: ${formatoMoneda(pedido.total)}</strong>
      </footer>
    `;
    listaPedidos.appendChild(item);
  }

  modal.classList.add("modal--abierto");
}

function cerrarModalPedidos(): void {
  document.querySelector("[data-modal-pedidos]")?.classList.remove("modal--abierto");
}

/* ---------------------------------------------------------------------- */
/* Inicialización global                                                  */
/* ---------------------------------------------------------------------- */

function inicializarCarritoGlobal(): void {
  document.querySelector("[data-abrir-carrito]")?.addEventListener("click", abrirPanelCarrito);
  document.querySelector("[data-cerrar-carrito]")?.addEventListener("click", cerrarPanelCarrito);
  document.querySelector("[data-overlay]")?.addEventListener("click", () => {
    cerrarPanelCarrito();
    cerrarModalPedidos();
  });
  document.querySelector("[data-cerrar-modal-pedidos]")?.addEventListener("click", cerrarModalPedidos);

  document.addEventListener("click", (evento) => {
    const objetivo = evento.target as HTMLElement;
    if (objetivo.closest("[data-abrir-pedidos]")) abrirModalPedidos();
  });

  inicializarCupon();
  inicializarCheckout();
  actualizarBadge();
}

document.addEventListener("DOMContentLoaded", inicializarCarritoGlobal);
