import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { HolidaysService } from './holidays.service'

@Injectable()
export class HolidaySchedulerService {
  private readonly logger = new Logger(HolidaySchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
  ) {}

  // Runs Jan 1 every year at 00:01
  @Cron('1 0 1 1 *')
  async autoFetchHolidaysForAllOrgs() {
    this.logger.log('Auto-fetching holidays for new year...')
    const nextYear = new Date().getFullYear() + 1

    const masters = await this.prisma.holidayMaster.findMany({
      where: { country_code: { not: null } },
    })

    for (const master of masters) {
      try {
        const { created } = await this.holidaysService.fetchAndPendHolidaysForOrg(master.organization_id, nextYear)
        if (created > 0) {
          this.logger.log(`Org ${master.organization_id}: ${created} holidays pending review for ${nextYear}`)

          // Schedule auto-apply check if configured
          if (master.auto_apply_if_not_reviewed) {
            const deadlineDays = master.pending_review_deadline_days ?? 7
            setTimeout(async () => {
              try {
                const pending = await this.holidaysService.getPendingHolidays(master.organization_id, nextYear)
                if (pending.length > 0) {
                  await this.holidaysService.applyPendingHolidays(master.organization_id, nextYear)
                  this.logger.log(`Org ${master.organization_id}: Auto-applied ${pending.length} pending holidays for ${nextYear}`)
                }
              } catch (err) {
                this.logger.error(`Auto-apply failed for org ${master.organization_id}: ${err}`)
              }
            }, deadlineDays * 24 * 60 * 60 * 1000)
          }
        }
      } catch (err) {
        this.logger.error(`Failed to fetch holidays for org ${master.organization_id}: ${err}`)
      }
    }
  }
}
