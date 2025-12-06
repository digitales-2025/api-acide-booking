import {
  BadRequestException,
  Injectable,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import * as excelJs from 'exceljs';
import { CreateHotelExpenseDto } from '../dto';
import {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseDocumentType,
} from '@prisma/client';
import { ExpenseRepository } from '../repositories/expense.repository';
import { CreateExpenseUseCase } from './create-expense.use-case';
import { UserData, HttpResponse } from 'src/interfaces';

@Injectable()
export class ImportExpensesUseCase {
  private readonly logger = new Logger(ImportExpensesUseCase.name);

  constructor(
    private readonly expenseRepository: ExpenseRepository,
    private readonly createExpenseUseCase: CreateExpenseUseCase,
  ) {}

  async execute(
    file: Express.Multer.File,
    continueOnError: boolean,
    user: UserData,
  ): Promise<
    HttpResponse<{
      total: number;
      successful: number;
      failed: number;
      errors: Array<{
        row: number;
        data: Record<string, unknown>;
        error: string;
      }>;
    }>
  > {
    try {
      // Leer el archivo Excel usando exceljs
      const workbook = new excelJs.Workbook();
      await workbook.xlsx.load(file.buffer as any);

      // Obtener la primera hoja del workbook (que debería ser "Plantilla")
      const worksheet = workbook.worksheets[0];

      if (!worksheet || worksheet.rowCount <= 1) {
        throw new BadRequestException(
          'El archivo no contiene datos o está vacío',
        );
      }

      // Mapear las cabeceras esperadas (índice a nombre de campo)
      const headerMap = {
        0: 'description', // Descripción
        1: 'category', // Categoría
        2: 'paymentMethod', // Método de pago
        3: 'amount', // Monto
        4: 'date', // Fecha
        5: 'documentType', // Tipo de documento
        6: 'documentNumber', // Número de documento
      };

      const data: Record<string, unknown>[] = [];

      // Procesar cada fila (omitiendo la cabecera)
      let firstRow = true;
      worksheet.eachRow((row) => {
        // Omitir la fila de cabecera
        if (firstRow) {
          firstRow = false;
          return;
        }

        // Crear un objeto con los datos de la fila usando el mapeo de cabeceras
        const rowData: Record<string, unknown> = {};

        row.eachCell((cell, colIndex) => {
          const fieldName = headerMap[colIndex - 1]; // exceljs usa índices base-1
          if (fieldName) {
            // Convertir el valor de la celda al tipo adecuado
            let value: unknown = cell.value;

            // Manejar diferentes tipos de valores de celda
            if (value && typeof value === 'object') {
              // Si es un objeto con propiedad 'result' (fechas en Excel), usar result
              if ('result' in value) {
                value = value.result;
              }
              // Si es un hipervínculo, extraer el texto
              else if ('text' in value && value.text) {
                value = value.text;
              }
              // Si es un objeto RichText (texto con formato)
              else if ('richText' in value) {
                value = String(cell.text);
              }
            }

            // Si es una fecha, formatearla como string YYYY-MM-DD
            if (value instanceof Date) {
              value = value.toISOString().split('T')[0];
            }

            rowData[fieldName] = value;
          }
        });

        // Solo agregar filas que tengan al menos un valor
        const hasValues = Object.values(rowData).some(
          (val) => val !== undefined && val !== null && val !== '',
        );

        if (hasValues) {
          data.push(rowData);
        }
      });

      if (data.length === 0) {
        throw new BadRequestException(
          'No se encontraron datos válidos para importar',
        );
      }

      // Procesar los datos convertidos
      const total = data.length;
      let successful = 0;
      let failed = 0;
      const errors: Array<{
        row: number;
        data: Record<string, unknown>;
        error: string;
      }> = [];

      // Procesar cada registro
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Normalizar y validar datos
          const expenseData = this.mapExcelRowToDto(row);

          // Crear el gasto usando el use-case
          await this.createExpenseUseCase.execute(expenseData, user);

          successful++;
        } catch (error) {
          failed++;

          // Registrar el error
          errors.push({
            row: i + 2, // +2 porque la fila 1 es la cabecera
            data: row,
            error: error.message || 'Error desconocido',
          });

          // Si no debe continuar con errores, parar
          if (!continueOnError) {
            break;
          }
        }
      }

      return {
        statusCode: HttpStatus.OK,
        message: `Importación completada: ${successful} de ${total} gastos importados correctamente.`,
        data: {
          total,
          successful,
          failed,
          errors,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error en importación de Excel: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Error al procesar el archivo: ${error.message}`,
      );
    }
  }

  /**
   * Mapear una fila de Excel a un DTO de gasto
   * @param row Fila del Excel
   * @returns DTO del gasto
   */
  private mapExcelRowToDto(
    row: Record<string, unknown>,
  ): CreateHotelExpenseDto {
    // Validar campos obligatorios
    if (
      !row.description ||
      !row.category ||
      !row.paymentMethod ||
      !row.amount ||
      !row.date
    ) {
      throw new BadRequestException('Faltan campos obligatorios en la fila');
    }

    // Mapear categoría de español a inglés
    const categoryMap: Record<string, ExpenseCategory> = {
      FIJO: ExpenseCategory.FIXED,
      VARIABLE: ExpenseCategory.VARIABLE,
      OTRO: ExpenseCategory.OTHER,
    };

    const category = String(row.category).toUpperCase().trim();
    if (!categoryMap[category]) {
      throw new BadRequestException(`Categoría inválida: ${category}`);
    }

    // Mapear método de pago de español a inglés
    const paymentMethodMap: Record<string, ExpensePaymentMethod> = {
      EFECTIVO: ExpensePaymentMethod.CASH,
      TRANSFERENCIA: ExpensePaymentMethod.TRANSFER,
      TARJETA: ExpensePaymentMethod.CARD,
    };

    const paymentMethod = String(row.paymentMethod).toUpperCase().trim();
    if (!paymentMethodMap[paymentMethod]) {
      throw new BadRequestException(
        `Método de pago inválido: ${paymentMethod}`,
      );
    }

    // Validar y convertir monto
    const amount = Number(row.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException(
        `Monto inválido: ${row.amount}. Debe ser un número mayor a 0`,
      );
    }

    // Validar y formatear fecha
    let date: string;

    // Verificar primero si es una instancia de Date
    if (row.date instanceof Date) {
      date = row.date.toISOString().split('T')[0];
    } else {
      // Convertir a string y procesar
      const dateString = String(row.date).trim();

      // Si es una fecha de Excel (número), convertirla
      if (dateString.match(/^\d+$/)) {
        // Es un número de Excel (días desde 1900-01-01)
        const excelDate = new Date(
          Math.round((Number(dateString) - 25569) * 86400 * 1000),
        );
        date = excelDate.toISOString().split('T')[0];
      } else if (this.isValidDateFormat(dateString)) {
        date = dateString;
      } else {
        throw new BadRequestException(
          `Formato de fecha inválido: ${dateString}. Debe ser YYYY-MM-DD`,
        );
      }
    }

    // Mapear datos a DTO
    const expenseDto: CreateHotelExpenseDto = {
      description: String(row.description).trim(),
      category: categoryMap[category],
      paymentMethod: paymentMethodMap[paymentMethod],
      amount: amount,
      date: date,
    };

    // Campos opcionales
    if (row.documentType) {
      const documentTypeMap: Record<string, ExpenseDocumentType> = {
        BOLETA: ExpenseDocumentType.RECEIPT,
        FACTURA: ExpenseDocumentType.INVOICE,
        OTRO: ExpenseDocumentType.OTHER,
      };

      const documentType = String(row.documentType).toUpperCase().trim();
      if (!documentTypeMap[documentType]) {
        throw new BadRequestException(
          `Tipo de documento inválido: ${documentType}`,
        );
      }

      expenseDto.documentType = documentTypeMap[documentType];

      // Si hay tipo de documento, el número es obligatorio
      if (!row.documentNumber) {
        throw new BadRequestException(
          'El número de documento es obligatorio cuando se especifica el tipo de documento',
        );
      }

      expenseDto.documentNumber = String(row.documentNumber).trim();
    } else if (row.documentNumber) {
      // Si hay número pero no tipo, también agregarlo
      expenseDto.documentNumber = String(row.documentNumber).trim();
    }

    return expenseDto;
  }

  /**
   * Validar si una cadena tiene formato de fecha YYYY-MM-DD
   * @param dateString Cadena a validar
   * @returns true si es una fecha válida
   */
  private isValidDateFormat(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return (
      !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateString
    );
  }
}
