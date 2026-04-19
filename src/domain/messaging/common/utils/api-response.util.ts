import { ApiResponseDto } from 'src/shared/dto';

export type SuccessApiResponse<T> = ApiResponseDto<T> & {
    success: true;
    message: string;
    data: T;
};

export function buildSuccessResponse<T>(
    data: T,
    message = 'OK',
): SuccessApiResponse<T> {
    return {
        success: true,
        message,
        data,
    };
}
