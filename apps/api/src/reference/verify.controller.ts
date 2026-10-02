/**
 * Public slip verification (target of the QR code printed on slips). Lets
 * screening officers and the public confirm a slip is genuine. Requires the
 * HMAC signature from the QR code, so application numbers cannot be
 * enumerated, and only minimal, masked data is returned.
 */
import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { STATUS_LABELS, ApplicationStatus, isValidApplicationId } from '@armyx/shared';
import { slipSignature } from '@armyx/shared/server';
import { DatabaseService } from '../infra/database.service';
import { RateLimit } from '../common/rate-limit';

const key = () => Buffer.from(process.env.BLIND_INDEX_KEY ?? '', 'base64');

@Controller('verify')
export class VerifyController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @RateLimit({ name: 'verify-ip', by: 'ip', limit: 60, windowSec: 600 })
  async verify(@Query('id') id = '', @Query('s') sig = '') {
    const expected = isValidApplicationId(id) ? slipSignature(id, key()) : '';
    if (!expected || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new NotFoundException({ valid: false, message: 'This slip could not be verified' });
    }
    const [a] = await this.db.read(
      `SELECT a.application_no, a.surname, a.first_name, a.status, a.state_code, e.title
         FROM applications a JOIN exercises e ON e.id = a.exercise_id WHERE a.application_no = $1`,
      [id.toUpperCase()],
    );
    if (!a) throw new NotFoundException({ valid: false, message: 'This slip could not be verified' });
    return {
      valid: true,
      applicationNo: a.application_no,
      name: `${a.surname} ${a.first_name.charAt(0)}.`,
      state: a.state_code,
      exercise: a.title,
      status: STATUS_LABELS[a.status as ApplicationStatus],
    };
  }
}
