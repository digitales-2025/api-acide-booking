import { Injectable } from '@nestjs/common';
import * as excelJs from 'exceljs';

@Injectable()
export class GenerateExpenseTemplateUseCase {
  async execute(): Promise<excelJs.Workbook> {
    // Crear libro de trabajo
    const workbook = new excelJs.Workbook();

    // Definir opciones para los dropdowns
    const categories = ['FIJO', 'VARIABLE', 'OTRO'];
    const paymentMethods = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
    const documentTypes = ['BOLETA', 'FACTURA', 'OTRO'];

    // Crear solo la hoja de Plantilla (con todo el contenido de Ejemplo)
    const templateSheet = workbook.addWorksheet('Plantilla');

    // Configurar la plantilla con el contenido que antes estaba en "Ejemplo"
    this.configureTemplateWithExampleContent(
      templateSheet,
      categories,
      paymentMethods,
      documentTypes,
    );

    // Hoja de Instrucciones
    const instructionsSheet = workbook.addWorksheet('Instrucciones');
    this.configureInstructionsSheet(
      instructionsSheet,
      categories,
      paymentMethods,
      documentTypes,
    );

    return workbook;
  }

  /**
   *
   * @param sheet Sheet de Excel
   * @param categories Categorías de gastos
   * @param paymentMethods Métodos de pago
   * @param documentTypes Tipos de documento
   */
  private configureTemplateWithExampleContent(
    sheet: excelJs.Worksheet,
    categories: string[],
    paymentMethods: string[],
    documentTypes: string[],
  ) {
    // Encabezados
    const headers = [
      'Descripción',
      'Categoría',
      'Método de pago',
      'Monto',
      'Fecha (YYYY-MM-DD)',
      'Tipo de documento',
      'Número de documento',
    ];

    // Agregar encabezados
    sheet.addRow(headers);

    // Estilo encabezados
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' },
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Agregar datos de ejemplo
    sheet.addRow([
      'Compra de suministros de limpieza',
      'VARIABLE',
      'EFECTIVO',
      150.5,
      '2025-01-15',
      'BOLETA',
      'B001-001234',
    ]);

    // Configurar anchos de columnas
    sheet.columns = headers.map(() => ({ width: 25 }));

    // Agregar listas desplegables
    // Columna B (Categoría) - índice 2
    // @ts-expect-error Property 'add' is not defined on type 'DataValidations'
    sheet.dataValidations.add('B2:B100', {
      type: 'list',
      allowBlank: false,
      formulae: [`"${categories.join(',')}"`],
      showDropDown: true,
    });

    // Columna C (Método de pago) - índice 3
    // @ts-expect-error Property 'add' is not defined on type 'DataValidations'
    sheet.dataValidations.add('C2:C100', {
      type: 'list',
      allowBlank: false,
      formulae: [`"${paymentMethods.join(',')}"`],
      showDropDown: true,
    });

    // Columna F (Tipo de documento) - índice 6
    // @ts-expect-error Property 'add' is not defined on type 'DataValidations'
    sheet.dataValidations.add('F2:F100', {
      type: 'list',
      allowBlank: true,
      formulae: [`"${documentTypes.join(',')}"`],
      showDropDown: true,
    });
  }

  /**
   *
   * @param sheet Sheet de Excel
   * @param categories Categorías de gastos
   * @param paymentMethods Métodos de pago
   * @param documentTypes Tipos de documento
   */
  private configureInstructionsSheet(
    sheet: excelJs.Worksheet,
    categories: string[],
    paymentMethods: string[],
    documentTypes: string[],
  ) {
    // Encabezados para la tabla de instrucciones
    sheet.addRow([
      'CAMPO',
      'DESCRIPCIÓN',
      'OBLIGATORIO',
      'FORMATO / VALORES VÁLIDOS',
    ]);

    // Datos para la tabla de instrucciones
    const instructionsData = [
      [
        'Descripción',
        'Descripción del gasto',
        'Sí',
        'Texto libre, máximo 255 caracteres',
      ],
      ['Categoría', 'Categoría del gasto', 'Sí', categories.join(', ')],
      [
        'Método de pago',
        'Método utilizado para pagar el gasto',
        'Sí',
        paymentMethods.join(', '),
      ],
      ['Monto', 'Monto del gasto', 'Sí', 'Número decimal (ej: 150.50)'],
      ['Fecha', 'Fecha del gasto', 'Sí', 'YYYY-MM-DD (ej: 2025-01-15)'],
      [
        'Tipo de documento',
        'Tipo de documento que respalda el gasto',
        'No',
        documentTypes.join(', '),
      ],
      [
        'Número de documento',
        'Número del documento',
        'No',
        'Texto libre, máximo 50 caracteres. Requerido si se especifica tipo de documento',
      ],
    ];

    // Agregar cada fila a la hoja
    instructionsData.forEach((row) => {
      sheet.addRow(row);
    });

    // Espacio antes de la tabla de traducciones
    sheet.addRow([]);
    sheet.addRow([]);

    // TABLA DE TRADUCCIONES DE OPCIONES
    sheet.addRow(['TABLA DE TRADUCCIONES', '', '', '']);
    const headerRow = sheet.lastRow;
    headerRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' },
    };
    headerRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).alignment = { horizontal: 'center' };
    sheet.mergeCells(`A${headerRow.number}:D${headerRow.number}`);

    // Encabezados para tabla de traducciones
    sheet.addRow(['CAMPO', 'VALOR', 'TRADUCCIÓN', 'DESCRIPCIÓN']);

    // Datos para la tabla de traducciones: Categorías
    sheet.addRow([
      'Categoría',
      'FIJO',
      'FIJO',
      'Gastos fijos mensuales (alquiler, servicios públicos, etc.)',
    ]);
    sheet.addRow([
      'Categoría',
      'VARIABLE',
      'VARIABLE',
      'Gastos variables (suministros, mantenimiento, etc.)',
    ]);
    sheet.addRow([
      'Categoría',
      'OTRO',
      'OTRO',
      'Otros gastos no categorizados',
    ]);

    // Datos para la tabla de traducciones: Métodos de pago
    sheet.addRow([
      'Método de pago',
      'EFECTIVO',
      'EFECTIVO',
      'Pago en efectivo',
    ]);
    sheet.addRow([
      'Método de pago',
      'TRANSFERENCIA',
      'TRANSFERENCIA',
      'Pago por transferencia bancaria',
    ]);
    sheet.addRow([
      'Método de pago',
      'TARJETA',
      'TARJETA',
      'Pago con tarjeta de débito o crédito',
    ]);

    // Datos para la tabla de traducciones: Tipos de documento
    sheet.addRow(['Tipo de documento', 'BOLETA', 'BOLETA', 'Boleta de venta']);
    sheet.addRow(['Tipo de documento', 'FACTURA', 'FACTURA', 'Factura']);
    sheet.addRow([
      'Tipo de documento',
      'OTRO',
      'OTRO',
      'Otro tipo de documento',
    ]);

    // Estilo para la tabla de traducciones
    const translationStartRow = headerRow.number + 2; // +1 para el encabezado, +1 para empezar en datos
    const translationEndRow = translationStartRow + 8; // 3 categorías + 3 métodos + 3 tipos doc - 1

    // Aplicar estilos al encabezado de la tabla de traducciones
    sheet.getRow(translationStartRow - 1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Aplicar estilos a los datos de la tabla de traducciones
    for (let i = translationStartRow; i <= translationEndRow; i++) {
      sheet.getRow(i).eachCell((cell, colNumber) => {
        // Agrupar por secciones con colores
        const isCategoria = i <= translationStartRow + 2; // Primeras 3 filas son categorías
        const isMetodoPago =
          i > translationStartRow + 2 && i <= translationStartRow + 5; // Siguientes 3 son métodos de pago

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: isCategoria
              ? 'FFE6EFF7'
              : isMetodoPago
                ? 'FFFCE4D6'
                : 'FFE2EFDA', // Verde claro para tipos de documento
          },
        };

        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Resaltar los valores originales (columna 2)
        if (colNumber === 2) {
          cell.font = { bold: true };
        }

        // Alineación
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    }

    // Espacio antes de las notas finales
    sheet.addRow([]);

    // Agregar notas adicionales
    sheet.addRow([
      'NOTA:',
      'Las celdas con listas desplegables están disponibles en la hoja "Plantilla" para "Categoría", "Método de pago" y "Tipo de documento"',
    ]);

    sheet.addRow([
      'IMPORTANTE:',
      'Los campos marcados como obligatorios deben completarse para cada gasto',
    ]);

    sheet.addRow([
      'IMPORTANTE:',
      'Si se especifica un "Tipo de documento", el "Número de documento" es obligatorio',
    ]);

    // Estilos para las notas finales (resaltadas)
    const notesStartRow = translationEndRow + 3;
    for (let i = notesStartRow; i <= notesStartRow + 2; i++) {
      sheet.getRow(i).getCell(1).font = {
        bold: true,
        color: { argb: 'FF4F81BD' },
      };
      sheet.getRow(i).getCell(2).font = { italic: true };
    }

    // Ajustar anchos de columna
    sheet.columns = [
      { width: 18 }, // Campo
      { width: 20 }, // Descripción/Valor
      { width: 20 }, // Obligatorio/Traducción
      { width: 50 }, // Formato/Descripción
    ];

    // Estilos para la tabla principal
    // Estilo para encabezados de la primera tabla
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }, // Azul más oscuro para los encabezados
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Texto blanco
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Estilo para las celdas de datos de la primera tabla
    for (let i = 2; i <= instructionsData.length + 1; i++) {
      sheet.getRow(i).eachCell((cell, colNumber) => {
        // Fondo alternado para mejor legibilidad
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: i % 2 === 0 ? 'FFE6EFF7' : 'FFFFFFFF' }, // Alternamos azul claro y blanco
        };

        // Resaltar la columna de obligatorio
        if (colNumber === 3) {
          cell.font = {
            bold: cell.value === 'Sí',
            color: { argb: cell.value === 'Sí' ? 'FFFF0000' : 'FF000000' }, // Rojo para "Sí", negro para "No"
          };
        }

        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Alineación
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    }

    // Congelar la primera fila (encabezados)
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }
}
