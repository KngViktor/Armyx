/**
 * The currently open recruitment exercise and its eligibility rules. This is
 * read on almost every portal request, so it is cached in-process (5s) and in
 * Redis (60s). Admin changes call `invalidate()`.
 */
import { Injectable } from '@nestjs/common';
import { RK, type EligibilityRules } from '@armyx/shared';
import { DatabaseService } from '../infra/database.service';
import { RedisService } from '../infra/redis.service';

export interface Exercise {
  id: string;
  code: string;
  title: string;
  state: 'draft' | 'open' | 'closed';
  opensAt: string;
  closesAt: string;
  rules: EligibilityRules;
  quotas: Record<string, number>;
}

@Injectable()
export class ExerciseService {
  private memo: { at: number; value: Exercise | null } | undefined;

  constructor(private readonly db: DatabaseService, private readonly redis: RedisService) {}

  async active(): Promise<Exercise | null> {
    if (this.memo && Date.now() - this.memo.at < 5_000) return this.memo.value;
    const raw = await this.redis.client.get(RK.activeExercise());
    let value: Exercise | null;
    if (raw) value = JSON.parse(raw);
    else {
      const [row] = await this.db.read(
        `SELECT id, code, title, state, opens_at, closes_at, rules, quotas FROM exercises
          WHERE state = 'open' ORDER BY opens_at DESC LIMIT 1`,
      );
      value = row
        ? { id: row.id, code: row.code, title: row.title, state: row.state, opensAt: row.opens_at.toISOString(),
            closesAt: row.closes_at.toISOString(), rules: row.rules, quotas: row.quotas }
        : null;
      await this.redis.client.set(RK.activeExercise(), JSON.stringify(value), 'EX', 60);
    }
    this.memo = { at: Date.now(), value };
    return value;
  }

  /** True when the exercise is open and now is within its application window. */
  isAcceptingApplications(ex: Exercise | null, now = new Date()): ex is Exercise {
    return !!ex && ex.state === 'open' && now >= new Date(ex.opensAt) && now <= new Date(ex.closesAt);
  }

  async invalidate() {
    this.memo = undefined;
    await this.redis.client.del(RK.activeExercise());
  }
}
