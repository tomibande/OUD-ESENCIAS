/**
 * auth.ts
 * Controla los formularios de login.html y registro.html.
 * RF-01, RF-02, RF-03, HU-01, HU-02.
 */

import { existeEmail, registrarUsuario, iniciarSesion, obtenerSesionActual } from "./api.js";
import { escaparHtml } from "./app.js";

function mostrarError(contenedor: HTMLElement, mensaje: string): void {
  contenedor.textContent = mensaje;
  contenedor.hidden = false;
}

function ocultarError(contenedor: HTMLElement): void {
  contenedor.hidden = true;
  contenedor.textContent = "";
}

/** Redirige según el rol tras un login exitoso. */
function redirigirPorRol(rol: "cliente" | "administrador"): void {
  window.location.href = rol === "administrador" ? "admin.html" : "index.html";
}

function inicializarLogin(): void {
  const formulario = document.querySelector<HTMLFormElement>("[data-form-login]");
  if (!formulario) return;

  // Si ya hay sesión activa, no tiene sentido mostrar el login de nuevo.
  const sesionExistente = obtenerSesionActual();
  if (sesionExistente) {
    redirigirPorRol(sesionExistente.usuario.rol);
    return;
  }

  const cajaError = formulario.querySelector<HTMLElement>("[data-error]")!;
  const botón = formulario.querySelector<HTMLButtonElement>("[type=submit]")!;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarError(cajaError);

    const email = (formulario.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (formulario.elements.namedItem("password") as HTMLInputElement).value;

    botón.disabled = true;
    botón.textContent = "Verificando…";

    try {
      const sesion = await iniciarSesion(email, password);
      redirigirPorRol(sesion.usuario.rol);
    } catch (error) {
      mostrarError(cajaError, error instanceof Error ? error.message : "No se pudo iniciar sesión.");
      botón.disabled = false;
      botón.textContent = "Ingresar";
    }
  });
}

function validarPasswordSegura(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(password)) return "La contraseña debe incluir al menos una letra mayúscula.";
  if (!/[0-9]/.test(password)) return "La contraseña debe incluir al menos un número.";
  return null;
}

function inicializarRegistro(): void {
  const formulario = document.querySelector<HTMLFormElement>("[data-form-registro]");
  if (!formulario) return;

  const cajaError = formulario.querySelector<HTMLElement>("[data-error]")!;
  const cajaExito = formulario.querySelector<HTMLElement>("[data-exito]")!;
  const botón = formulario.querySelector<HTMLButtonElement>("[type=submit]")!;
  const campoEmail = formulario.elements.namedItem("email") as HTMLInputElement;

  // RF-02: feedback temprano de correo duplicado al salir del campo.
  campoEmail.addEventListener("blur", async () => {
    if (!campoEmail.value.trim()) return;
    const duplicado = await existeEmail(campoEmail.value.trim());
    campoEmail.setCustomValidity(duplicado ? "Ese correo ya está registrado." : "");
    campoEmail.reportValidity();
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarError(cajaError);
    cajaExito.hidden = true;

    const nombreCompleto = (formulario.elements.namedItem("nombreCompleto") as HTMLInputElement).value.trim();
    const email = (formulario.elements.namedItem("email") as HTMLInputElement).value.trim();
    const telefono = (formulario.elements.namedItem("telefono") as HTMLInputElement).value.trim();
    const password = (formulario.elements.namedItem("password") as HTMLInputElement).value;
    const confirmarPassword = (formulario.elements.namedItem("confirmarPassword") as HTMLInputElement).value;

    const errorPassword = validarPasswordSegura(password);
    if (errorPassword) return mostrarError(cajaError, errorPassword);
    if (password !== confirmarPassword) return mostrarError(cajaError, "Las contraseñas no coinciden.");

    botón.disabled = true;
    botón.textContent = "Creando cuenta…";

    try {
      await registrarUsuario({ nombreCompleto, email, telefono, password });
      cajaExito.textContent = `¡Cuenta creada, ${escaparHtml(nombreCompleto.split(" ")[0])}! Ya podés iniciar sesión.`;
      cajaExito.hidden = false;
      formulario.reset();
      setTimeout(() => (window.location.href = "login.html"), 1600);
    } catch (error) {
      mostrarError(cajaError, error instanceof Error ? error.message : "No se pudo completar el registro.");
      botón.disabled = false;
      botón.textContent = "Crear cuenta";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarLogin();
  inicializarRegistro();
});
