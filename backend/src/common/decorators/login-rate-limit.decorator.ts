import { SetMetadata } from '@nestjs/common';

export const LOGIN_RATE_LIMIT_KEY = 'loginRateLimit';

export const LoginRateLimit = () => SetMetadata(LOGIN_RATE_LIMIT_KEY, true);
