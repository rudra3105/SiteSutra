'use server'
// @ts-nocheck

import { db, labourTeams, teamMembers, labour, attendance, siteWorkStatus } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { eq, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createTeam(siteId: string, name: string, attendanceMethod = 'INDIVIDUAL') {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  const id = crypto.randomUUID()
  await db.insert(labourTeams).values({ id, siteId, name, attendanceMethod })
  revalidatePath(`/sites/${siteId}/labour`)
  return { success: true, id }
}

export async function getTeams(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  const teams = await db.select().from(labourTeams).where(eq(labourTeams.siteId, siteId))
  // Attach members to each team
  const allMembers: any[] = await db
    .select({ member: teamMembers, worker: labour })
    .from(teamMembers)
    .leftJoin(labour, eq(teamMembers.labourId, labour.id))
    .where(inArray(teamMembers.teamId, teams.map((t: any) => t.id)))
  return teams.map((team: any) => ({
    ...team,
    members: allMembers.filter((m: any) => m.member.teamId === team.id).map((m: any) => m.worker),
  }))
}

export async function addTeamMember(teamId: string, labourId: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  const id = crypto.randomUUID()
  await db.insert(teamMembers).values({ id, teamId, labourId }).onConflictDoNothing()
  revalidatePath(`/sites/${siteId}/labour`)
  return { success: true }
}

export async function removeTeamMember(teamId: string, labourId: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.labourId, labourId)))
  revalidatePath(`/sites/${siteId}/labour`)
  return { success: true }
}

export async function deleteTeam(teamId: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
  await db.delete(labourTeams).where(eq(labourTeams.id, teamId))
  revalidatePath(`/sites/${siteId}/labour`)
  return { success: true }
}

export async function markTeamAttendance(teamId: string, siteId: string, date: string, status: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  // Get all members of the team
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))
  let marked = 0
  for (const m of members) {
    const id = crypto.randomUUID()
    try {
      await db.insert(attendance).values({
        id, siteId, labourId: m.labourId, userId: session.userId,
        date, status, halfDay: false, synced: true,
      }).onConflictDoNothing()
      marked++
    } catch {}
  }
  revalidatePath(`/sites/${siteId}/labour`)
  return { success: true, marked }
}

// Site work status
export async function getSiteWorkStatus(siteId: string) {
  const session = await requireSession()
  if (!session) return null
  const [status] = await db.select().from(siteWorkStatus).where(eq(siteWorkStatus.siteId, siteId)).limit(1)
  return status ?? { siteId, workStage: 'FOUNDATION', attendanceMethod: 'INDIVIDUAL' }
}

export async function updateSiteWorkStatus(siteId: string, workStage: string, attendanceMethod: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  const existing = await db.select().from(siteWorkStatus).where(eq(siteWorkStatus.siteId, siteId)).limit(1)
  if (existing.length > 0) {
    await db.update(siteWorkStatus).set({ workStage, attendanceMethod, updatedAt: new Date().toISOString() })
      .where(eq(siteWorkStatus.siteId, siteId))
  } else {
    await db.insert(siteWorkStatus).values({ id: crypto.randomUUID(), siteId, workStage, attendanceMethod })
  }
  revalidatePath(`/sites/${siteId}`)
  return { success: true }
}