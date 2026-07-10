/**
 * types.ts
 * Definiciones de tipos compartidos por toda la capa de interfaz (Frontend).
 * Reflejan el modelo entidad-relación descrito en la documentación
 * (usuarios, productos, roles) — RF-01 a RF-18.
 */

export type Rol = "cliente" | "administrador";

export interface Usuario {
  id: number;
  nombreCompleto: string;
  email: string;
  telefono: string;
  rol: Rol;
}

/** Sesión persistida en el cliente tras un login exitoso (RF-03). */
export interface Sesion {
  token: string;
  usuario: Usuario;
}

export interface PiramideOlfativa {
  salida: string[];
  corazon: string[];
  fondo: string[];
}

export interface Perfume {
  id: number;
  nombre: string;
  marca: string;
  familiaOlfativa: string;
  precio: number;
  ml: number;
  stock: number;
  imagen: string;
  descripcion: string;
  piramide: PiramideOlfativa;
  /** Baja lógica (RF-16): el registro permanece en base de datos pero oculto al público. */
  activo: boolean;
}

/** Payload para el alta de un perfume desde el panel administrativo (RF-14, RF-15). */
export type NuevoPerfume = Omit<Perfume, "id" | "activo">;

export interface FiltrosCatalogo {
  busqueda: string;
  marca: string;
  notaOlfativa: string;
  precioMin: number | null;
  precioMax: number | null;
}

export interface ItemCarrito {
  perfumeId: number;
  cantidad: number;
}

export interface Cupon {
  codigo: string;
  porcentaje: number;
  vigenteDesde: string; // ISO date
  vigenteHasta: string; // ISO date
  usosMaximos: number;
  usosRegistrados: number;
}

export interface LineaPedido {
  perfumeId: number;
  nombre: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export type EstadoPedido = "pendiente" | "aprobado" | "rechazado";

export interface Pedido {
  id: string;
  usuarioId: number;
  fecha: string; // ISO date
  lineas: LineaPedido[];
  cuponAplicado: string | null;
  descuento: number;
  total: number;
  estado: EstadoPedido;
  estadoEnvio: "en preparación" | "en camino" | "entregado";
}

export interface RespuestaPago {
  aprobado: boolean;
  motivoRechazo?: string;
  idTransaccion?: string;
}
