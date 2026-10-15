import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

const SINGLE_LINE = /^[^\p{Cc}]*$/u;
const MULTI_LINE = /^(?:[^\p{Cc}]|[\t\n\r])*$/u;

export const SingleLineText = () =>
  applyDecorators(
    Matches(SINGLE_LINE, {
      message: '$property must not contain line breaks or control characters',
    }),
  );

export const MultiLineText = () =>
  applyDecorators(
    Matches(MULTI_LINE, { message: '$property must not contain control characters' }),
  );
