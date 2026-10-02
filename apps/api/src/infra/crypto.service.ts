import { Injectable } from '@nestjs/common';
import { FieldCrypto } from '@armyx/shared/server';

/** Nest wrapper around the shared field-level encryption helper. */
@Injectable()
export class CryptoService extends FieldCrypto {
  constructor() {
    super(FieldCrypto.optionsFromEnv());
  }
}
