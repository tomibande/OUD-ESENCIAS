/**
 * api.ts
 * -----------------------------------------------------------------------
 * Capa de acceso a datos del Frontend.
 *
 * El equipo de Backend (TypeScript + Node/Express + SQLite, ver sección 8
 * de la documentación) todavía no expone endpoints estables. Para no
 * bloquear el desarrollo de interfaz, esta capa SIMULA el comportamiento
 * del servidor (persistencia en localStorage + data/perfumes.json como
 * seed) respetando exactamente los mismos contratos (nombres de función,
 * forma de los datos, reglas de negocio) que va a tener la API real.
 *
 * Cuando el backend esté listo, ALCANZA con reemplazar el cuerpo de cada
 * función por un `fetch("/api/...")` — el resto del frontend (catalogo.ts,
 * carrito.ts, admin.ts, auth.ts) no necesita cambiar porque solo dependen
 * de estas firmas.
 * -----------------------------------------------------------------------
 */

import type {
  Perfume,
  NuevoPerfume,
  Usuario,
  Sesion,
  Cupon,
  Pedido,
  LineaPedido,
  RespuestaPago,
} from "./types.js";

const DB_KEY = "oud_db_v1";
const SESION_KEY = "oud_sesion";

interface BaseDeDatosSimulada {
  perfumes: Perfume[];
  usuarios: (Usuario & { passwordHash: string })[];
  pedidos: Pedido[];
  cupones: Cupon[];
  cuponesUsadosPorUsuario: Record<number, string[]>;
}

/* ---------------------------------------------------------------------- */
/* Inicialización / semilla                                               */
/* ---------------------------------------------------------------------- */

let cache: BaseDeDatosSimulada | null = null;

async function cargarSemilla(): Promise<Perfume[]> {
  const res = await fetch("./data/perfumes.json");
  if (!res.ok) throw new Error("No se pudo cargar el catálogo inicial.");
  return (await res.json()) as Perfume[];
}

async function obtenerDB(): Promise<BaseDeDatosSimulada> {
  if (cache) return cache;

  const guardada = localStorage.getItem(DB_KEY);
  if (guardada) {
    cache = JSON.parse(guardada) as BaseDeDatosSimulada;
    return cache;
  }

  const perfumesSemilla = await cargarSemilla();
  cache = {
    perfumes: perfumesSemilla,
    usuarios: [
      {
        id: 1,
        nombreCompleto: "Administrador General",
        email: "admin@oudesencias.com",
        telefono: "000-000-0000",
        rol: "administrador",
        passwordHash: await hashSimple("admin1234"),
      },
    ],
    pedidos: [],
    cupones: [
      {
        codigo: "BIENVENIDO10",
        porcentaje: 10,
        vigenteDesde: "2026-01-01",
        vigenteHasta: "2026-12-31",
        usosMaximos: 999,
        usosRegistrados: 0,
      },
      {
        codigo: "OUD20",
        porcentaje: 20,
        vigenteDesde: "2026-06-01",
        vigenteHasta: "2026-08-31",
        usosMaximos: 999,
        usosRegistrados: 0,
      },
    ],
    cuponesUsadosPorUsuario: {},
  };
  persistir();
  return cache;
}

function persistir(): void {
  if (cache) localStorage.setItem(DB_KEY, JSON.stringify(cache));
}

/** Hash simulado en el cliente (RNF-02). El backend real usa bcrypt con salting. */
async function hashSimple(texto: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------------------------------------------------------------------- */
/* Catálogo (RF-05, RF-06, RF-07)                                         */
/* ---------------------------------------------------------------------- */

/** Devuelve solo perfumes activos y con stock > 0 (visibles al público). */
export async function obtenerCatalogoPublico(): Promise<Perfume[]> {
  const db = await obtenerDB();
  return db.perfumes.filter((p) => p.activo && p.stock > 0);
}

/** Devuelve todos los perfumes activos (para el panel admin, incluye stock 0). */
export async function obtenerPerfumesAdmin(): Promise<Perfume[]> {
  const db = await obtenerDB();
  return db.perfumes.filter((p) => p.activo);
}

export async function obtenerMarcasDisponibles(): Promise<string[]> {
  const perfumes = await obtenerCatalogoPublico();
  return Array.from(new Set(perfumes.map((p) => p.marca))).sort();
}

export async function obtenerNotasDisponibles(): Promise<string[]> {
  const perfumes = await obtenerCatalogoPublico();
  return Array.from(new Set(perfumes.map((p) => p.familiaOlfativa))).sort();
}

/* ---------------------------------------------------------------------- */
/* Autenticación (RF-01 a RF-04)                                          */
/* ---------------------------------------------------------------------- */

export async function existeEmail(email: string): Promise<boolean> {
  const db = await obtenerDB();
  return db.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function registrarUsuario(datos: {
  nombreCompleto: string;
  email: string;
  telefono: string;
  password: string;
}): Promise<Usuario> {
  const db = await obtenerDB();

  if (await existeEmail(datos.email)) {
    throw new Error("Ya existe una cuenta registrada con ese correo electrónico.");
  }

  const nuevo = {
    id: Date.now(),
    nombreCompleto: datos.nombreCompleto,
    email: datos.email,
    telefono: datos.telefono,
    rol: "cliente" as const,
    passwordHash: await hashSimple(datos.password),
  };

  db.usuarios.push(nuevo);
  persistir();

  const { passwordHash, ...usuarioPublico } = nuevo;
  return usuarioPublico;
}

export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  const db = await obtenerDB();
  const hash = await hashSimple(password);
  const usuario = db.usuarios.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash
  );

  if (!usuario) {
    throw new Error("Correo electrónico o contraseña incorrectos.");
  }

  const { passwordHash, ...usuarioPublico } = usuario;
  const sesion: Sesion = {
    token: `simulado.${await hashSimple(usuario.email + Date.now())}`,
    usuario: usuarioPublico,
  };

  sessionStorage.setItem(SESION_KEY, JSON.stringify(sesion));
  return sesion;
}

export function obtenerSesionActual(): Sesion | null {
  const guardada = sessionStorage.getItem(SESION_KEY);
  return guardada ? (JSON.parse(guardada) as Sesion) : null;
}

/** Cierra la sesión destruyendo el token del lado del cliente (RF-04). */
export function cerrarSesion(): void {
  sessionStorage.removeItem(SESION_KEY);
}

/* ---------------------------------------------------------------------- */
/* Carrito / Checkout (RF-08 a RF-13)                                     */
/* ---------------------------------------------------------------------- */

export async function obtenerPerfumePorId(id: number): Promise<Perfume | undefined> {
  const db = await obtenerDB();
  return db.perfumes.find((p) => p.id === id);
}

/** Valida un cupón contra vigencia, disponibilidad y uso previo del cliente (RF-11, RF-17). */
export async function validarCupon(
  codigo: string,
  usuarioId: number
): Promise<{ valido: boolean; motivo?: string; cupon?: Cupon }> {
  const db = await obtenerDB();
  const cupon = db.cupones.find((c) => c.codigo.toUpperCase() === codigo.toUpperCase());

  if (!cupon) return { valido: false, motivo: "El cupón ingresado no existe." };

  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy < cupon.vigenteDesde || hoy > cupon.vigenteHasta) {
    return { valido: false, motivo: "El cupón está fuera de su período de vigencia." };
  }
  if (cupon.usosRegistrados >= cupon.usosMaximos) {
    return { valido: false, motivo: "El cupón alcanzó su límite de usos." };
  }
  const usadosPorEsteUsuario = db.cuponesUsadosPorUsuario[usuarioId] ?? [];
  if (usadosPorEsteUsuario.includes(cupon.codigo.toUpperCase())) {
    return { valido: false, motivo: "Ya utilizaste este cupón anteriormente." };
  }

  return { valido: true, cupon };
}

/** Simula la pasarela de pagos (flujo tipo MercadoPago). ~90% de aprobación. */
async function simularPasarelaDePago(total: number): Promise<RespuestaPago> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (total <= 0) return { aprobado: false, motivoRechazo: "El monto de la operación es inválido." };
  const aprobado = Math.random() > 0.1;
  return aprobado
    ? { aprobado: true, idTransaccion: `MP-${Date.now()}` }
    : { aprobado: false, motivoRechazo: "El medio de pago rechazó la operación. Intentá nuevamente." };
}

/**
 * Procesa el checkout de forma atómica (RNF-06 / ACID): valida stock,
 * cobra, y solo si el pago es aprobado descuenta stock y persiste el
 * pedido. Si algo falla, el stock permanece intacto.
 */
export async function procesarCheckout(params: {
  usuarioId: number;
  items: { perfumeId: number; cantidad: number }[];
  codigoCupon: string | null;
}): Promise<Pedido> {
  const db = await obtenerDB();

  const lineas: LineaPedido[] = [];
  for (const item of params.items) {
    const perfume = db.perfumes.find((p) => p.id === item.perfumeId);
    if (!perfume || !perfume.activo) throw new Error("Uno de los perfumes ya no está disponible.");
    if (item.cantidad > perfume.stock) {
      throw new Error(`No hay stock suficiente de "${perfume.nombre}" (disponible: ${perfume.stock}).`);
    }
    lineas.push({
      perfumeId: perfume.id,
      nombre: perfume.nombre,
      marca: perfume.marca,
      cantidad: item.cantidad,
      precioUnitario: perfume.precio,
      subtotal: perfume.precio * item.cantidad,
    });
  }

  const subtotalBruto = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  let descuento = 0;
  let cuponAplicado: string | null = null;
  if (params.codigoCupon) {
    const resultado = await validarCupon(params.codigoCupon, params.usuarioId);
    if (!resultado.valido || !resultado.cupon) {
      throw new Error(resultado.motivo ?? "El cupón no es válido.");
    }
    descuento = Math.round(subtotalBruto * (resultado.cupon.porcentaje / 100));
    cuponAplicado = resultado.cupon.codigo;
  }

  const total = subtotalBruto - descuento;
  const respuestaPago = await simularPasarelaDePago(total);

  if (!respuestaPago.aprobado) {
    throw new Error(respuestaPago.motivoRechazo ?? "El pago no pudo procesarse.");
  }

  // A partir de acá el pago fue aprobado: se descuenta stock de forma atómica.
  for (const linea of lineas) {
    const perfume = db.perfumes.find((p) => p.id === linea.perfumeId)!;
    perfume.stock -= linea.cantidad;
  }

  if (cuponAplicado) {
    const cupon = db.cupones.find((c) => c.codigo === cuponAplicado)!;
    cupon.usosRegistrados += 1;
    const usados = db.cuponesUsadosPorUsuario[params.usuarioId] ?? [];
    db.cuponesUsadosPorUsuario[params.usuarioId] = [...usados, cuponAplicado];
  }

  const pedido: Pedido = {
    id: respuestaPago.idTransaccion ?? `PED-${Date.now()}`,
    usuarioId: params.usuarioId,
    fecha: new Date().toISOString(),
    lineas,
    cuponAplicado,
    descuento,
    total,
    estado: "aprobado",
    estadoEnvio: "en preparación",
  };

  db.pedidos.push(pedido);
  persistir();
  return pedido;
}

/** Historial de compras del cliente autenticado (RF-18). */
export async function obtenerHistorialPedidos(usuarioId: number): Promise<Pedido[]> {
  const db = await obtenerDB();
  return db.pedidos
    .filter((p) => p.usuarioId === usuarioId)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

/* ---------------------------------------------------------------------- */
/* Backoffice / Administración (RF-14 a RF-16)                            */
/* ---------------------------------------------------------------------- */

/** Alta de un nuevo perfume. Exige imagen (RF-15) validada previamente en admin.ts. */
export async function altaPerfume(datos: NuevoPerfume): Promise<Perfume> {
  const db = await obtenerDB();
  const nuevo: Perfume = { ...datos, id: Date.now(), activo: true };
  db.perfumes.push(nuevo);
  persistir();
  return nuevo;
}

/** Baja lógica: el registro no se borra, solo deja de ser visible (RF-16). */
export async function bajaPerfume(id: number): Promise<void> {
  const db = await obtenerDB();
  const perfume = db.perfumes.find((p) => p.id === id);
  if (!perfume) throw new Error("El perfume indicado no existe.");
  perfume.activo = false;
  persistir();
}
