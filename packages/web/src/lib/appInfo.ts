// La versión sale de package.json en vez de un literal aquí: un número de
// versión duplicado a mano se queda atrás en cuanto alguien publica sin acordarse
// de este fichero. Vite y Vitest resuelven el JSON, y con importación nombrada
// solo entra `version` al bundle, no la lista de dependencias.
import { version } from '../../package.json';

/**
 * `AppHeader` pinta este mismo nombre partido en `<span>` para acentuar
 * «Assessment», así que no puede consumir la constante; si se renombra el
 * producto, hay que tocar los dos sitios.
 */
export const APP_NAME = 'Mutator Assessment Report';
export const APP_VERSION = version;

/** Copyright holder tal cual figura en LICENSE: si divergen, uno de los dos miente. */
export const COPYRIGHT = '© 2026 Rubenav82';
export const LICENSE = 'MIT License';

export const CONTACT_EMAIL = 'rubenav82@gmail.com';
