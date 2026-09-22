/**
 * Fuente única del historial de cambios visible para el usuario, consumida por
 * el diálogo «Notas de versión» del panel de ayuda. Cada subida de versión
 * añade su entrada aquí en el mismo commit (constitución #8): el test de este
 * módulo fija que la primera entrada coincida con la versión de package.json,
 * así que subir una sin la otra rompe la suite.
 *
 * Las entradas se redactan para el usuario (qué cambió y qué le aporta), no
 * como lista de commits — para eso están git y docs/tasks.md.
 */
export interface ReleaseNote {
  /** Versión semver; la entrada más reciente es la de package.json. */
  version: string;
  /** Fecha de publicación en ISO `AAAA-MM-DD`; se muestra tal cual. */
  date: string;
  /** Cambios visibles para el usuario, uno por viñeta. */
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.7.0',
    date: '2026-09-22',
    changes: [
      'Nuevo botón «Exportar JSON» en el dashboard: guarda la comparación entera, con sus ficheros de origen y umbrales, en un fichero .mutadiff.json.',
      'Nueva zona «Importar comparación» en la pantalla inicial: abre ese fichero y vuelve al dashboard sin subir otra vez los reportes. Sirve para recuperar una comparación tras cerrar la pestaña o para pasársela a otra persona.',
    ],
  },
  {
    version: '1.6.2',
    date: '2026-09-19',
    changes: [
      'El panel «Acerca de» muestra el titular del copyright tal como figura en la licencia del proyecto.',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-09-19',
    changes: [
      'Actualizadas dependencias con vulnerabilidades publicadas (entre ellas el enrutador de la aplicación); sin cambios de comportamiento.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-09-18',
    changes: [
      'Nueva tabla «Por mutador» al final del dashboard: mutantes, supervivientes en cada ejecución con su delta, sin cubrir y score nuevo de cada mutador, ordenada por los que más supervivientes producen. Sirve para decidir qué mutadores excluir de la configuración. El informe exportado la incluye dentro del resumen.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09-18',
    changes: [
      'El informe exportado lista bajo cada retroceso sus nuevos supervivientes (línea, mutador y descripción), hasta diez por clase; si el detalle no cabe en el informe, lo dice en lugar de omitirlo en silencio.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-09-18',
    changes: [
      'Cada clase o fichero con mutantes que cambiaron de estado se puede desplegar, en las secciones y en la tabla completa, para ver qué mutantes dejaron de detectarse (o empezaron a detectarse), en qué línea y con qué mutador.',
      'Dentro del desplegable, un filtro «Solo nuevos supervivientes» deja a la vista únicamente los mutantes que ahora sobreviven y antes no.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-10',
    changes: [
      'Notas de versión consultables desde el panel de ayuda «?», con el historial de cambios de cada versión.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-18',
    changes: [
      'Cada KPI del resumen explica su significado al pasar el ratón o navegar con el teclado por su etiqueta, tanto en la aplicación como en el informe exportado.',
      'El informe impreso en PDF incluye un glosario al pie con las definiciones de los ocho KPI.',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-08-10',
    changes: ['Botón «Comparar» centrado en el formulario, con el aviso de validación debajo.'],
  },
  {
    version: '1.1.0',
    date: '2026-08-06',
    changes: [
      'Mutantes cubiertos por clase (base, nueva y variación) en la tabla completa del dashboard.',
      'Exportación del informe a PDF desde el propio navegador, sin instalar nada.',
      'Las cinco tablas del dashboard se paginan, con 5 filas por defecto y opción «Todas».',
      'Recuento de clases analizadas y clases con cobertura encabezando la comparación.',
      'La versión de la aplicación se muestra en el panel de ayuda «?».',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-29',
    changes: [
      'Primera versión estable con el nombre Mutator Assessment Report: comparación de dos ejecuciones de PiTest o Stryker íntegramente en el navegador, dashboard con retrocesos y clases sin cobertura, e informe HTML autocontenido exportable.',
    ],
  },
];
