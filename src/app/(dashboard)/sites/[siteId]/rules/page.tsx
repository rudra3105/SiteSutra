// @ts-nocheck
export const dynamic = 'force-dynamic'

import { db, idealRules, workTypes, materials } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { IdealRulesView } from '@/components/charts/IdealRulesView'

export default async function IdealRulesPage({ params }) {
  const { siteId } = params

  const [rules, wts, mats] = await Promise.all([
    db.select({
      rule: idealRules,
      workType: workTypes,
      material: materials,
    })
    .from(idealRules)
    .leftJoin(workTypes, eq(idealRules.workTypeId, workTypes.id))
    .leftJoin(materials, eq(idealRules.materialId, materials.id))
    .where(eq(idealRules.siteId, siteId)),
    db.select().from(workTypes).where(eq(workTypes.siteId, siteId)),
    db.select().from(materials).where(eq(materials.siteId, siteId)),
  ])

  const rulesFormatted = rules.map(r => ({
    ...r.rule,
    workType: r.workType,
    material: r.material,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Ideal Rules</h2>
        <p className="text-slate-600 text-sm">Define ideal material consumption per unit of work for this site</p>
      </div>
      <IdealRulesView siteId={siteId} rules={rulesFormatted} workTypes={wts} materials={mats} />
    </div>
  )
}
