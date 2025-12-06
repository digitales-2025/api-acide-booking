import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ImportExpensesDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo Excel con los gastos a importar (.xlsx)',
  })
  file: Express.Multer.File;

  @ApiProperty({
    description:
      'Indica si se debe continuar con la importación cuando hay errores',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  continueOnError?: boolean;
}
