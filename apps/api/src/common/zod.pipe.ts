import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType, z } from 'zod';

/** Validates and *transforms* (normalises) input using a shared Zod schema. */
export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_';
        fields[path] ??= issue.message;
      }
      throw new BadRequestException({ message: 'Validation failed', fields });
    }
    return result.data;
  }
}
