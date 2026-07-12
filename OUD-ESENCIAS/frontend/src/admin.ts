/**
 * admin.ts
 * Controla admin.html: alta y baja lógica de perfumes.
 * RF-14, RF-15, RF-16, HU-09, HU-11.
 *
 * El administrador SOLO tiene estas dos facultades (ver sección 1 y 6.2
 * de la documentación): no accede a datos de clientes ni de ventas.
 */

import type { NuevoPerfume, Perfume } from "./types.js";
import { obtenerPerfumesAdmin, altaPerfume, bajaPerfume } from "./api.js";
import { formatoMoneda, escaparHtml, exigirSesion } from "./app.js";

function mostrarError(contenedor: HTMLElement, mensaje: string): void {
  contenedor.textContent = mensaje;
  contenedor.hidden = false;
}

function ocultarError(contenedor: HTMLElement): void {
  contenedor.hidden = true;
}

async function renderizarTablaProductos(): Promise<void> {
  const cuerpoTabla = document.querySelector<HTMLElement>("[data-tabla-productos]");
  const vacio = document.querySelector<HTMLElement>("[data-productos-vacio]");
  if (!cuerpoTabla) return;

  const productos = await obtenerPerfumesAdmin();
  cuerpoTabla.innerHTML = "";

  if (productos.length === 0) {
    if (vacio) vacio.hidden = false;
    return;
  }
  if (vacio) vacio.hidden = true;

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

    const botonBaja = fila.querySelector<HTMLButtonElement>("[data-baja]");
    if (botonBaja) {
      botonBaja.addEventListener("click", async () => {
        const confirmado = window.confirm(
          `¿Confirmás dar de baja "${producto.nombre}"? Podrá desactivarse y dejará de mostrarse a los clientes, pero el registro histórico se conserva.`
        );
        if (!confirmado) return;
        await bajaPerfume(producto.id);
        renderizarTablaProductos();
      });
    }

    cuerpoTabla.appendChild(fila);
  }
}

/** RF-15: exige que la URL/archivo de imagen esté presente antes de guardar. */
function validarFormularioAlta(formulario: HTMLFormElement): string | null {
  const datos = new FormData(formulario);
  const imagen = String(datos.get("imagen") ?? "").trim();
  if (!imagen) return "Debés cargar un archivo de imagen del perfume antes de guardar.";

  const camposObligatorios = ["nombre", "marca", "familiaOlfativa", "precio", "ml", "stock", "descripcion"];
  for (const campo of camposObligatorios) {
    if (!String(datos.get(campo) ?? "").trim()) {
      return "Completá todos los campos obligatorios del formulario.";
    }
  }
  return null;
}

function leerNotas(valor: string): string[] {
  return valor
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

function inicializarFormularioAlta(): void {
  const formulario = document.querySelector<HTMLFormElement>("[data-form-alta]");
  if (!formulario) return;

  const cajaError = document.querySelector<HTMLElement>("[data-error]")!;
  const cajaExito = document.querySelector<HTMLElement>("[data-exito]")!;
  const inputImagen = formulario.querySelector<HTMLInputElement>("[data-input-imagen]");
  const previa = formulario.querySelector<HTMLImageElement>("[data-previa-imagen]");

  // Vista previa local del archivo cargado (no sustituye la validación de RF-15).
  if (inputImagen) {
    inputImagen.addEventListener("change", () => {
      const archivos = inputImagen.files;
      const archivo = archivos && archivos.length > 0 ? archivos[0] : null;
      if (!archivo || !previa) return;
      previa.src = URL.createObjectURL(archivo);
      previa.hidden = false;
      (formulario.elements.namedItem("imagen") as HTMLInputElement).value = archivo.name;
    });
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarError(cajaError);
    cajaExito.hidden = true;

    const errorValidacion = validarFormularioAlta(formulario);
    if (errorValidacion) return mostrarError(cajaError, errorValidacion);

    const datos = new FormData(formulario);
    const archivosImagen = inputImagen ? inputImagen.files : null;
    const imagenSubida = archivosImagen && archivosImagen.length > 0 ? archivosImagen[0] : null;

    const nuevoPerfume: NuevoPerfume = {
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

    const boton = formulario.querySelector<HTMLButtonElement>("[type=submit]")!;
    boton.disabled = true;
    boton.textContent = "Guardando…";

    try {
      const creado = await altaPerfume(nuevoPerfume);
      cajaExito.textContent = `"${creado.nombre}" fue agregado al catálogo.`;
      cajaExito.hidden = false;
      formulario.reset();
      if (previa) previa.hidden = true;
      renderizarTablaProductos();
    } catch (error) {
      mostrarError(cajaError, error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar perfume";
    }
  });
}

async function inicializarPanelAdmin(): Promise<void> {
  if (!document.querySelector("[data-panel-admin]")) return;
  if (!exigirSesion("administrador")) return;

  inicializarFormularioAlta();
  await renderizarTablaProductos();
}

document.addEventListener("DOMContentLoaded", inicializarPanelAdmin);
