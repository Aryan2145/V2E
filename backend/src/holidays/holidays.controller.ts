import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { HolidayEntityType, HolidayStatus, HolidayType } from '@prisma/client'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { HolidaysService } from './holidays.service'
import type { NagerCountry } from './nager.service'
import { UpdateHolidayMasterDto } from './dto/update-holiday-master.dto'
import { UpdateWorkingDaysDto } from './dto/update-working-days.dto'
import { CreateOrgHolidayDto, UpdateOrgHolidayDto } from './dto/create-org-holiday.dto'
import { CreateDepartmentHolidayDto, UpdateDepartmentHolidayDto } from './dto/create-department-holiday.dto'
import {
  CreateIndividualHolidayDto, UpdateIndividualHolidayDto,
  CreateIndividualWorkingDaysDto, UpdateIndividualWorkingDaysDto,
} from './dto/create-individual-holiday.dto'
import { ImportNationalHolidaysDto, ApplyPendingHolidaysDto } from './dto/import-national-holidays.dto'

@ApiTags('holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/org/:orgId/holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  // ─── Master ──────────────────────────────────────────────────────────────────

  @Get('master')
  @ApiOperation({ summary: 'Get holiday master config' })
  getConfig(@Param('orgId') orgId: string) {
    return this.service.getConfig(orgId)
  }

  @Patch('master')
  @ApiOperation({ summary: 'Update holiday master config' })
  updateConfig(@Param('orgId') orgId: string, @Body() dto: UpdateHolidayMasterDto) {
    return this.service.updateConfig(orgId, dto)
  }

  // ─── National holidays (Nager proxy) ─────────────────────────────────────────

  @Get('national/available-countries')
  @ApiOperation({ summary: 'Get available countries from Nager.Date' })
  getAvailableCountries(): Promise<NagerCountry[]> {
    return this.service.getAvailableCountries()
  }

  @Get('national/fetch')
  @ApiOperation({ summary: 'Fetch national holidays preview from Nager.Date (not saved)' })
  fetchNational(@Param('orgId') orgId: string, @Query('year') year: string) {
    return this.service.fetchNationalHolidaysPreview(orgId, parseInt(year) || new Date().getFullYear())
  }

  @Post('national/import')
  @ApiOperation({ summary: 'Import national holidays as active' })
  importNational(@Param('orgId') orgId: string, @Body() dto: ImportNationalHolidaysDto) {
    return this.service.importNationalHolidays(orgId, dto.year, dto.holidays)
  }

  @Get('national/pending')
  @ApiOperation({ summary: 'Get pending-review national holidays for a year' })
  getPending(@Param('orgId') orgId: string, @Query('year') year: string) {
    return this.service.getPendingHolidays(orgId, parseInt(year) || new Date().getFullYear())
  }

  @Post('national/apply')
  @ApiOperation({ summary: 'Apply selected pending holidays, delete rest' })
  applyPending(@Param('orgId') orgId: string, @Body() dto: ApplyPendingHolidaysDto) {
    return this.service.applyPendingHolidays(orgId, dto.year, dto.holiday_ids)
  }

  @Delete('national/pending/:year')
  @ApiOperation({ summary: 'Dismiss all pending holidays for a year' })
  dismissPending(@Param('orgId') orgId: string, @Param('year') year: string) {
    return this.service.dismissPendingHolidays(orgId, parseInt(year))
  }

  // ─── Org working days ─────────────────────────────────────────────────────────

  @Get('org/working-days')
  @ApiOperation({ summary: 'Get org working days' })
  getOrgWorkingDays(@Param('orgId') orgId: string) {
    return this.service.getOrgWorkingDays(orgId)
  }

  @Patch('org/working-days')
  @ApiOperation({ summary: 'Update org working days' })
  updateOrgWorkingDays(@Param('orgId') orgId: string, @Body() dto: UpdateWorkingDaysDto) {
    return this.service.updateOrgWorkingDays(orgId, dto)
  }

  // ─── Org holidays ─────────────────────────────────────────────────────────────

  @Get('org/holidays')
  @ApiOperation({ summary: 'List org holidays' })
  listOrgHolidays(
    @Param('orgId') orgId: string,
    @Query('year') year?: string,
    @Query('type') type?: HolidayType,
    @Query('status') status?: HolidayStatus,
  ) {
    return this.service.listOrgHolidays(orgId, year ? parseInt(year) : undefined, type, status)
  }

  @Post('org/holidays')
  @ApiOperation({ summary: 'Create org holiday' })
  createOrgHoliday(@Param('orgId') orgId: string, @Body() dto: CreateOrgHolidayDto) {
    return this.service.createOrgHoliday(orgId, dto)
  }

  @Patch('org/holidays/:id')
  @ApiOperation({ summary: 'Update org holiday' })
  updateOrgHoliday(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateOrgHolidayDto) {
    return this.service.updateOrgHoliday(orgId, id, dto)
  }

  @Delete('org/holidays/:id')
  @ApiOperation({ summary: 'Delete org holiday' })
  deleteOrgHoliday(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.deleteOrgHoliday(orgId, id)
  }

  // ─── Dept working days ────────────────────────────────────────────────────────

  @Get('dept/:deptId/working-days')
  @ApiOperation({ summary: 'Get dept working days' })
  getDeptWorkingDays(@Param('orgId') orgId: string, @Param('deptId') deptId: string) {
    return this.service.getDeptWorkingDays(orgId, deptId)
  }

  @Patch('dept/:deptId/working-days')
  @ApiOperation({ summary: 'Upsert dept working days' })
  upsertDeptWorkingDays(
    @Param('orgId') orgId: string,
    @Param('deptId') deptId: string,
    @Body() dto: UpdateWorkingDaysDto,
  ) {
    return this.service.upsertDeptWorkingDays(orgId, deptId, dto)
  }

  @Delete('dept/:deptId/working-days')
  @ApiOperation({ summary: 'Remove dept working days override' })
  deleteDeptWorkingDays(@Param('orgId') orgId: string, @Param('deptId') deptId: string) {
    return this.service.deleteDeptWorkingDays(orgId, deptId)
  }

  // ─── Dept holidays ────────────────────────────────────────────────────────────

  @Get('dept/:deptId/holidays')
  @ApiOperation({ summary: 'List dept holidays' })
  listDeptHolidays(
    @Param('orgId') orgId: string,
    @Param('deptId') deptId: string,
    @Query('year') year?: string,
  ) {
    return this.service.listDeptHolidays(orgId, deptId, year ? parseInt(year) : undefined)
  }

  @Post('dept/:deptId/holidays')
  @ApiOperation({ summary: 'Create dept holiday' })
  createDeptHoliday(
    @Param('orgId') orgId: string,
    @Param('deptId') deptId: string,
    @Body() dto: CreateDepartmentHolidayDto,
  ) {
    return this.service.createDeptHoliday(orgId, deptId, dto)
  }

  @Patch('dept/:deptId/holidays/:id')
  @ApiOperation({ summary: 'Update dept holiday' })
  updateDeptHoliday(
    @Param('orgId') orgId: string,
    @Param('deptId') deptId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentHolidayDto,
  ) {
    return this.service.updateDeptHoliday(orgId, deptId, id, dto)
  }

  @Delete('dept/:deptId/holidays/:id')
  @ApiOperation({ summary: 'Delete dept holiday' })
  deleteDeptHoliday(
    @Param('orgId') orgId: string,
    @Param('deptId') deptId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteDeptHoliday(orgId, deptId, id)
  }

  // ─── Individual working days ──────────────────────────────────────────────────

  @Get('user/:userId/working-days')
  @ApiOperation({ summary: 'List user working day schedules' })
  listUserWorkingDays(@Param('orgId') orgId: string, @Param('userId') userId: string) {
    return this.service.listUserWorkingDays(orgId, userId)
  }

  @Post('user/:userId/working-days')
  @ApiOperation({ summary: 'Create user working day schedule' })
  createUserWorkingDays(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: CreateIndividualWorkingDaysDto,
  ) {
    return this.service.createUserWorkingDays(orgId, userId, dto)
  }

  @Patch('user/:userId/working-days/:id')
  @ApiOperation({ summary: 'Update user working day schedule' })
  updateUserWorkingDays(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIndividualWorkingDaysDto,
  ) {
    return this.service.updateUserWorkingDays(orgId, userId, id, dto)
  }

  @Delete('user/:userId/working-days/:id')
  @ApiOperation({ summary: 'Delete user working day schedule' })
  deleteUserWorkingDays(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteUserWorkingDays(orgId, userId, id)
  }

  // ─── Individual holidays ──────────────────────────────────────────────────────

  @Get('user/:userId/holidays')
  @ApiOperation({ summary: 'List user holidays' })
  listUserHolidays(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Query('year') year?: string,
  ) {
    return this.service.listUserHolidays(orgId, userId, year ? parseInt(year) : undefined)
  }

  @Post('user/:userId/holidays')
  @ApiOperation({ summary: 'Create user holiday' })
  createUserHoliday(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: CreateIndividualHolidayDto,
  ) {
    return this.service.createUserHoliday(orgId, userId, dto)
  }

  @Patch('user/:userId/holidays/:id')
  @ApiOperation({ summary: 'Update user holiday' })
  updateUserHoliday(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIndividualHolidayDto,
  ) {
    return this.service.updateUserHoliday(orgId, userId, id, dto)
  }

  @Delete('user/:userId/holidays/:id')
  @ApiOperation({ summary: 'Delete user holiday' })
  deleteUserHoliday(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteUserHoliday(orgId, userId, id)
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  @Get('check')
  @ApiOperation({ summary: 'Check if a date is a working day' })
  checkDate(
    @Param('orgId') orgId: string,
    @Query('date') date: string,
    @Query('userId') userId?: string,
    @Query('deptId') deptId?: string,
  ) {
    return this.service.checkDate(orgId, new Date(date), deptId, userId)
  }

  @Get('range')
  @ApiOperation({ summary: 'Get non-working dates in range' })
  getRange(
    @Param('orgId') orgId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userId') userId?: string,
    @Query('deptId') deptId?: string,
  ) {
    return this.service.getHolidaysInRange(orgId, new Date(from), new Date(to), deptId, userId)
  }

  // ─── Audit log ────────────────────────────────────────────────────────────────

  @Get('audit')
  @ApiOperation({ summary: 'Get holiday adjustment audit log' })
  getAuditLog(
    @Param('orgId') orgId: string,
    @Query('year') year?: string,
    @Query('entity_type') entity_type?: HolidayEntityType,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAuditLog(orgId, {
      year: year ? parseInt(year) : undefined,
      entity_type,
      from,
      to,
    })
  }
}
