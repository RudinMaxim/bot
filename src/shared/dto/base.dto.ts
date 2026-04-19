import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

export class BaseDto {
    @ApiProperty({
        example: '2023-01-01T00:00:00.000Z',
        description: 'Creation date',
        required: false,
        readOnly: true,
    })
    @IsOptional()
    createdAt: Date | null;

    @ApiProperty({
        example: '2023-01-01T00:00:00.000Z',
        description: 'Last update date',
        required: false,
        readOnly: true,
    })
    @IsOptional()
    updatedAt: Date | null;
}

export class BaseDtoWithID extends BaseDto {
    @ApiProperty({ required: false, readOnly: true })
    @IsInt()
    @IsOptional()
    id: number;
}

export class BaseDtoWithUUID extends BaseDto {
    @ApiProperty({ required: false })
    @IsUUID()
    uuid: string;
}
