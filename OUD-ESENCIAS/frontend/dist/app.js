/**
 * app.ts
 * Lógica compartida por TODAS las páginas: navbar, estado de sesión,
 * menú móvil (RNF-01) y contador del carrito. Se importa desde cada
 * página específica (catalogo.ts, admin.ts, etc.) además de incluirse
 * directamente donde no hace falta más lógica (login/registro).
 */
import { obtenerSesionActual, cerrarSesion } from "./api.js";
const CARRITO_KEY = "oud_carrito";
export function contarItemsCarrito() {
    const guardado = localStorage.getItem(CARRITO_KEY);
    if (!guardado)
        return 0;
    try {
        const items = JSON.parse(guardado);
        return items.reduce((acc, i) => acc + i.cantidad, 0);
    }
    catch {
        return 0;
    }
}
export function formatoMoneda(valor) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(valor);
}
/** Pinta el estado de la barra de navegación según haya o no sesión activa. */
export function inicializarNavbar() {
    const sesion = obtenerSesionActual();
    const zonaAuth = document.querySelector("[data-zona-auth]");
    const badgeCarrito = document.querySelector("[data-badge-carrito]");
    const toggleMenu = document.querySelector("[data-toggle-menu]");
    const nav = document.querySelector("[data-nav-principal]");
    if (badgeCarrito) {
        const cantidad = contarItemsCarrito();
        badgeCarrito.textContent = String(cantidad);
        badgeCarrito.hidden = cantidad === 0;
    }
    if (zonaAuth) {
        if (sesion) {
            const primerNombre = sesion.usuario.nombreCompleto.split(" ")[0];
            zonaAuth.innerHTML = `
        <span class="navbar__saludo">Hola, ${escaparHtml(primerNombre)}</span>
        ${sesion.usuario.rol === "administrador"
                ? `<a class="btn btn--fantasma btn--sm" href="admin.html">Panel admin</a>`
                : `<button class="btn btn--fantasma btn--sm" data-abrir-pedidos type="button">Mis pedidos</button>`}
        <button class="btn btn--linea btn--sm" data-cerrar-sesion type="button">Salir</button>
      `;
            zonaAuth.querySelector("[data-cerrar-sesion]")?.addEventListener("click", () => {
                cerrarSesion();
                window.location.href = "login.html";
            });
        }
        else {
            zonaAuth.innerHTML = `
        <a class="btn btn--fantasma btn--sm" href="login.html">Ingresar</a>
        <a class="btn btn--linea btn--sm" href="registro.html">Crear cuenta</a>
      `;
        }
    }
    if (toggleMenu && nav) {
        toggleMenu.addEventListener("click", () => {
            const abierto = nav.classList.toggle("nav-principal--abierto");
            toggleMenu.setAttribute("aria-expanded", String(abierto));
        });
    }
}
export function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}
/** Redirige al login si la página requiere sesión y no la hay. */
export function exigirSesion(rolRequerido) {
    const sesion = obtenerSesionActual();
    if (!sesion) {
        window.location.href = "login.html";
        return false;
    }
    if (rolRequerido && sesion.usuario.rol !== rolRequerido) {
        window.location.href = "index.html";
        return false;
    }
    return true;
}
document.addEventListener("DOMContentLoaded", inicializarNavbar);
