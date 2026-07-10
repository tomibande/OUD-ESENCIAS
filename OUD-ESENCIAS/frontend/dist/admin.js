/**
 * admin.ts
 * Controla admin.html: alta y baja lógica de perfumes.
 * RF-14, RF-15, RF-16, HU-09, HU-11.
 *
 * El administrador SOLO tiene estas dos facultades (ver sección 1 y 6.2
 * de la documentación): no accede a datos de clientes ni de ventas.
 */
import { obtenerPerfumesAdmin, altaPerfume, bajaPerfume } from "./api.js";
import { formatoMoneda, escaparHtml, exigirSesion } from "./app.js";
function mostrarError(contenedor, mensaje) {
    contenedor.textContent = mensaje;
    contenedor.hidden = false;
}
function ocultarError(contenedor) {
    contenedor.hidden = true;
}
async function renderizarTablaProductos() {
    const cuerpoTabla = document.querySelector("[data-tabla-productos]");
    const vacio = document.querySelector("[data-productos-vacio]");
    if (!cuerpoTabla)
        return;
    const productos = await obtenerPerfumesAdmin();
    cuerpoTabla.innerHTML = "";
    if (productos.length === 0) {
        if (vacio)
            vacio.hidden = false;
        return;
    }
    if (vacio)
        vacio.hidden = true;
    for (const producto of productos) {
        const fila = document.createElement("tr");
        fila.innerHTML = `
      <td class="tabla-admin__imagen">
        <img src="${escaparHtml(producto.imagen)}" alt="${escaparHtml(producto.nombre)}" loading="lazy">
      </td>
      <td>
        <p class="tabla-admin__nombre">${escaparHtml(producto.nombre)}</p>
        <p class="tabla-admin__marca">${escaparHtml(producto.marca)} · ${escaparHtml(producto.familiaOlfativa)}</p>
      </td>
      <td>${formatoMoneda(producto.precio)}</td>
      <td>${producto.ml} ml</td>
      <td>
        <span class="etiqueta-stock ${producto.stock === 0 ? "etiqueta-stock--agotado" : ""}">
          ${producto.stock} u.
        </span>
      </td>
      <td>
        <button type="button" class="btn btn--linea btn--sm" data-baja="${producto.id}">
          Quitar del catálogo
        </button>
      </td>
    `;
        fila.querySelector("[data-baja]")?.addEventListener("click", async () => {
            const confirmado = window.confirm(`¿Confirmás dar de baja "${producto.nombre}"? Podrá desactivarse y dejará de mostrarse a los clientes, pero el registro histórico se conserva.`);
            if (!confirmado)
                return;
            await bajaPerfume(producto.id);
            renderizarTablaProductos();
        });
        cuerpoTabla.appendChild(fila);
    }
}
/** RF-15: exige que la URL/archivo de imagen esté presente antes de guardar. */
function validarFormularioAlta(formulario) {
    const datos = new FormData(formulario);
    const imagen = String(datos.get("imagen") ?? "").trim();
    if (!imagen)
        return "Debés cargar un archivo de imagen del perfume antes de guardar.";
    const camposObligatorios = ["nombre", "marca", "familiaOlfativa", "precio", "ml", "stock", "descripcion"];
    for (const campo of camposObligatorios) {
        if (!String(datos.get(campo) ?? "").trim()) {
            return "Completá todos los campos obligatorios del formulario.";
        }
    }
    return null;
}
function leerNotas(valor) {
    return valor
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
}
function inicializarFormularioAlta() {
    const formulario = document.querySelector("[data-form-alta]");
    if (!formulario)
        return;
    const cajaError = formulario.querySelector("[data-error]");
    const cajaExito = formulario.querySelector("[data-exito]");
    const inputImagen = formulario.querySelector("[data-input-imagen]");
    const previa = formulario.querySelector("[data-previa-imagen]");
    // Vista previa local del archivo cargado (no sustituye la validación de RF-15).
    inputImagen?.addEventListener("change", () => {
        const archivo = inputImagen.files?.[0];
        if (!archivo || !previa)
            return;
        previa.src = URL.createObjectURL(archivo);
        previa.hidden = false;
        formulario.elements.namedItem("imagen").value = archivo.name;
    });
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        ocultarError(cajaError);
        cajaExito.hidden = true;
        const errorValidacion = validarFormularioAlta(formulario);
        if (errorValidacion)
            return mostrarError(cajaError, errorValidacion);
        const datos = new FormData(formulario);
        const imagenSubida = inputImagen?.files?.[0];
        const nuevoPerfume = {
            nombre: String(datos.get("nombre")).trim(),
            marca: String(datos.get("marca")).trim(),
            familiaOlfativa: String(datos.get("familiaOlfativa")).trim(),
            precio: Number(datos.get("precio")),
            ml: Number(datos.get("ml")),
            stock: Number(datos.get("stock")),
            // Si el admin sube un archivo local se usa su URL temporal; si no, se acepta un link.
            imagen: imagenSubida ? URL.createObjectURL(imagenSubida) : String(datos.get("imagen")).trim(),
            descripcion: String(datos.get("descripcion")).trim(),
            piramide: {
                salida: leerNotas(String(datos.get("notasSalida") ?? "")),
                corazon: leerNotas(String(datos.get("notasCorazon") ?? "")),
                fondo: leerNotas(String(datos.get("notasFondo") ?? "")),
            },
        };
        const boton = formulario.querySelector("[type=submit]");
        boton.disabled = true;
        boton.textContent = "Guardando…";
        try {
            const creado = await altaPerfume(nuevoPerfume);
            cajaExito.textContent = `"${creado.nombre}" fue agregado al catálogo.`;
            cajaExito.hidden = false;
            formulario.reset();
            if (previa)
                previa.hidden = true;
            renderizarTablaProductos();
        }
        catch (error) {
            mostrarError(cajaError, error instanceof Error ? error.message : "No se pudo guardar el producto.");
        }
        finally {
            boton.disabled = false;
            boton.textContent = "Guardar perfume";
        }
    });
}
async function inicializarPanelAdmin() {
    if (!document.querySelector("[data-panel-admin]"))
        return;
    if (!exigirSesion("administrador"))
        return;
    inicializarFormularioAlta();
    await renderizarTablaProductos();
}
document.addEventListener("DOMContentLoaded", inicializarPanelAdmin);
