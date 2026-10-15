import { ValidateIf } from 'class-validator';

export const IsOptionalNotNull = () => ValidateIf((_, value: unknown) => value !== undefined);
