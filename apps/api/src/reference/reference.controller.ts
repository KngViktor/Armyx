/**
 * Public reference data. Responses carry long-lived Cache-Control so the
 * Cloudflare CDN absorbs nearly all of this traffic during spikes.
 */
import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { NIGERIAN_STATES, STATE_BY_CODE, DOCUMENT_RULES, QUALIFICATION_LABELS, ENTRY_TYPE_LABELS, TRADES } from '@armyx/shared';
import { ExerciseService } from './exercise.service';

@Controller('reference')
export class ReferenceController {
  constructor(private readonly exercises: ExerciseService) {}

  @Get('states')
  @Header('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
  states() {
    return NIGERIAN_STATES.map(({ code, name }) => ({ code, name }));
  }

  @Get('states/:code/lgas')
  @Header('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
  lgas(@Param('code') code: string) {
    const s = STATE_BY_CODE[code.toUpperCase()];
    if (!s) throw new NotFoundException('Unknown state');
    return s.lgas;
  }

  @Get('form-options')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  formOptions() {
    return { qualifications: QUALIFICATION_LABELS, entryTypes: ENTRY_TYPE_LABELS, trades: TRADES, documents: DOCUMENT_RULES };
  }

  /** Active exercise summary + rules (rules are public: applicants must know them). */
  @Get('exercise')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60')
  async exercise() {
    const ex = await this.exercises.active();
    if (!ex) return { open: false };
    return {
      open: this.exercises.isAcceptingApplications(ex),
      code: ex.code, title: ex.title, opensAt: ex.opensAt, closesAt: ex.closesAt, rules: ex.rules,
    };
  }
}
