import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  Header,
  UploadedFile,
  BadRequestException,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { ExpenseService } from '../services/expense.service';
import { Response } from 'express';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiConsumes,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserData } from 'src/interfaces';
import {
  CreateHotelExpenseDto,
  UpdateHotelExpenseDto,
  DeleteHotelExpenseDto,
  ImportExpensesDto,
} from '../dto';
import { HotelExpenseEntity } from '../entities/expense.entity';
import { BaseApiResponse } from 'src/utils/base-response/BaseApiResponse.dto';
import { Auth, GetUser } from '../../auth/decorators';
import {
  PaginatedResponse,
  PaginationMetadata,
} from 'src/utils/paginated-response/PaginatedResponse.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { HttpResponse } from 'src/interfaces';

/**
 * Controlador REST para gestionar gastos del hotel.
 * Expone endpoints para operaciones CRUD sobre gastos.
 */
@ApiTags('Admin Expenses')
@ApiBadRequestResponse({
  description:
    'Bad Request - Error en la validación de datos o solicitud incorrecta',
})
@ApiUnauthorizedResponse({
  description: 'Unauthorized - No autorizado para realizar esta operación',
})
@Controller({ path: 'expenses', version: '1' })
@Auth()
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  /**
   * Crea un nuevo gasto
   */
  @Post()
  @ApiOperation({ summary: 'Crear nuevo gasto' })
  @ApiResponse({
    status: 201,
    description: 'Gasto creado exitosamente',
    type: BaseApiResponse,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos',
  })
  create(
    @Body() createHotelExpenseDto: CreateHotelExpenseDto,
    @GetUser() user: UserData,
  ): Promise<BaseApiResponse<HotelExpenseEntity>> {
    return this.expenseService.create(createHotelExpenseDto, user);
  }

  /**
   * Obtiene todos los gastos
   */
  @Get()
  @ApiOperation({ summary: 'Obtener todos los gastos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de todos los gastos',
    type: [HotelExpenseEntity],
  })
  findAll(): Promise<HotelExpenseEntity[]> {
    return this.expenseService.findAll();
  }

  /**
   * Descarga la plantilla Excel para importar gastos
   */
  @Get('import/template')
  @ApiOperation({ summary: 'Descargar plantilla Excel para importar gastos' })
  @ApiResponse({
    status: 200,
    description: 'Plantilla Excel para importar gastos',
  })
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename=plantilla_gastos.xlsx')
  async downloadTemplate(@Res() res: Response) {
    const workbook = await this.expenseService.generateExpenseTemplate();

    // Configurar el response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_gastos.xlsx',
    );

    // Enviar el archivo
    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Importa gastos desde un archivo Excel
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importar gastos desde archivo Excel' })
  @ApiResponse({
    status: 200,
    description: 'Gastos importados exitosamente',
  })
  @ApiBadRequestResponse({
    description: 'Archivo inválido o datos incorrectos',
  })
  importExpenses(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: Express.Multer.File,
    @Body() importExpensesDto: ImportExpensesDto,
    @GetUser() user: UserData,
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
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    return this.expenseService.importFromExcel(
      file,
      importExpensesDto.continueOnError || false,
      user,
    );
  }

  /**
   * Obtiene un gasto por su ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener gasto por ID' })
  @ApiParam({ name: 'id', description: 'ID del gasto' })
  @ApiOkResponse({
    description: 'Gasto encontrado',
    type: HotelExpenseEntity,
  })
  @ApiNotFoundResponse({
    description: 'Gasto no encontrado',
  })
  findOne(@Param('id') id: string): Promise<HotelExpenseEntity> {
    return this.expenseService.findOne(id);
  }

  /**
   * Obtiene gastos por fecha con filtros avanzados
   */
  @Get('filter/date')
  @ApiOperation({
    summary: 'Obtener gastos por fecha con filtros avanzados',
    description:
      'Obtiene gastos paginados con filtros por fecha, categoría, método de pago, tipo de documento y búsqueda',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: String,
    description: 'Mes para filtrar (ejemplo: 01, 02, etc.)',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: String,
    description: 'Año para filtrar (ejemplo: 2023, 2024, etc.)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Término de búsqueda en descripción y número de documento',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filtro por categoría (array)',
    example: 'FIXED,VARIABLE,OTHER',
  })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    type: String,
    description: 'Filtro por método de pago (array)',
    example: 'CASH,TRANSFER,CARD',
  })
  @ApiQuery({
    name: 'documentType',
    required: false,
    type: String,
    description: 'Filtro por tipo de documento (array)',
    example: 'RECEIPT,INVOICE,OTHER',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Campo para ordenar',
    example: 'date',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    type: String,
    enum: ['asc', 'desc'],
    description: 'Orden de clasificación',
    example: 'desc',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Cantidad de elementos por página',
    type: Number,
    example: 10,
  })
  @ApiOkResponse({
    schema: {
      title: 'PaginatedExpenseResponse',
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(HotelExpenseEntity) },
        },
        meta: { $ref: getSchemaPath(PaginationMetadata) },
      },
    },
    description: 'Lista paginada de gastos',
  })
  findByDate(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('documentType') documentType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ): Promise<PaginatedResponse<HotelExpenseEntity>> {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSizeNumber = parseInt(pageSize, 10) || 10;

    // Construir opciones de ordenamiento
    const sortOptions: any = {};
    if (sortBy) {
      sortOptions.field = sortBy;
      sortOptions.order = sortOrder || 'desc';
    }

    return this.expenseService.findByDatePaginated(
      { page: pageNumber, pageSize: pageSizeNumber },
      {
        month,
        year,
        search,
        category,
        paymentMethod,
        documentType,
      },
      sortOptions,
    );
  }

  /**
   * Actualiza un gasto existente
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar gasto existente' })
  @ApiParam({ name: 'id', description: 'ID del gasto' })
  @ApiResponse({
    status: 200,
    description: 'Gasto actualizado exitosamente',
    type: BaseApiResponse,
  })
  update(
    @Param('id') id: string,
    @Body() updateHotelExpenseDto: UpdateHotelExpenseDto,
    @GetUser() user: UserData,
  ): Promise<BaseApiResponse<HotelExpenseEntity>> {
    return this.expenseService.update(id, updateHotelExpenseDto, user);
  }

  /**
   * Elimina múltiples gastos
   */
  @Delete('remove/all')
  @ApiOperation({ summary: 'Eliminar múltiples gastos' })
  @ApiResponse({
    status: 200,
    description: 'Gastos eliminados exitosamente',
    type: BaseApiResponse,
  })
  @ApiBadRequestResponse({
    description: 'IDs inválidos o gastos no existen',
  })
  deleteMany(
    @Body() deleteHotelExpenseDto: DeleteHotelExpenseDto,
    @GetUser() user: UserData,
  ): Promise<BaseApiResponse<HotelExpenseEntity[]>> {
    return this.expenseService.deleteMany(deleteHotelExpenseDto, user);
  }

  /*
   * ENDPOINT COMENTADO - GENERACIÓN DE GASTOS AUTOMÁTICOS
   * ====================================================
   * Este endpoint ha sido comentado temporalmente.
   * Fecha de comentado: ${new Date().toISOString().split('T')[0]}
   */

  /*
  /**
   * Genera gastos automáticos para un año específico
   */
  /*
  @Post('generate/:year')
  @ApiOperation({
    summary: 'Generar gastos automáticos para un año',
    description:
      'Genera gastos realistas basados en datos históricos para todos los meses del año especificado',
  })
  @ApiParam({
    name: 'year',
    description: 'Año para el cual generar los gastos (ejemplo: 2025)',
    type: Number,
  })
  @ApiResponse({
    status: 201,
    description: 'Gastos generados exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            year: { type: 'number' },
            totalExpenses: { type: 'number' },
            totalAmount: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Año inválido',
  })
  generateExpenses(
    @Param('year') year: string,
    @GetUser() user: UserData,
  ): Promise<BaseApiResponse<any>> {
    const yearNumber = parseInt(year, 10);
    return this.expenseService.generateExpensesForYear(yearNumber, user);
  }
  */
}
