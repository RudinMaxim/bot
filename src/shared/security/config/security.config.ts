import { Injectable } from '@nestjs/common';
import { SecretsConfig } from '../../../infrastructure/config';
import { SecurityConfig } from './security.config.interface';

@Injectable()
export class SecurityConfigService {
    constructor(private readonly secrets: SecretsConfig) {}

    get value(): SecurityConfig {
        return this.secrets.security;
    }
}
