import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organizationGroup.findMany({
      include: {
        _count: { select: { organizations: true } },
        organizations: { select: { id: true, name: true, slug: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.organizationGroup.findUnique({
      where: { id },
      include: {
        organizations: {
          select: {
            id: true, name: true, slug: true, status: true, industry: true, country: true,
            _count: { select: { members: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async create(dto: CreateGroupDto) {
    const existing = await this.prisma.organizationGroup.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' is already taken`);
    return this.prisma.organizationGroup.create({ data: dto });
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findOne(id);
    return this.prisma.organizationGroup.update({ where: { id }, data: dto });
  }

  async addOrg(groupId: string, orgId: string) {
    await this.findOne(groupId);
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { group_id: groupId },
      select: { id: true, name: true, group_id: true },
    });
  }

  async removeOrg(groupId: string, orgId: string) {
    await this.findOne(groupId);
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { group_id: null },
      select: { id: true, name: true, group_id: true },
    });
  }

  async getGroupUsers(groupId: string) {
    await this.findOne(groupId);
    const members = await this.prisma.organizationMember.findMany({
      where: { organization: { group_id: groupId }, is_active: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    // Deduplicate by user_id, collecting all orgs per user
    const userMap = new Map<string, { id: string; name: string; email: string; orgs: { id: string; name: string; role: string }[] }>();
    for (const m of members) {
      if (!userMap.has(m.user_id)) {
        userMap.set(m.user_id, { ...m.user, orgs: [] });
      }
      userMap.get(m.user_id)!.orgs.push({ id: m.organization.id, name: m.organization.name, role: m.role });
    }
    return Array.from(userMap.values());
  }
}
