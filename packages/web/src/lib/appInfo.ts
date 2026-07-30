// La versión sale de package.json en vez de un literal aquí: un número de
// versión duplicado a mano se queda atrás en cuanto alguien publica sin acordarse
// de este fichero. Vite y Vitest resuelven el JSON, y con importación nombrada
// solo entra `version` al bundle, no la lista de dependencias.
import { version } from '../../package.json';

export const APP_NAME = 'Mutation Assessment Report';
export const APP_VERSION = version;

/** Copyright holder tal cual figura en LICENSE: si divergen, uno de los dos miente. */
export const COPYRIGHT = '© 2026 Rubenav82';
export const LICENSE = 'MIT License';

export const CONTACT_EMAIL = 'rubenav82@gmail.com';
