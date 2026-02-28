import { supabase } from '@/lib/supabase'
import { GanttPage } from '@/components/GanttPage'
import type { SectionWithTasks, TaskWithCells, Section, Task, TaskCell, Milestone } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [{ data: sections }, { data: tasks }, { data: cells }, { data: milestones }] = await Promise.all([
    supabase.from('sections').select('*').order('sort_order'),
    supabase.from('tasks').select('*').order('sort_order'),
    supabase.from('task_cells').select('*'),
    supabase.from('milestones').select('*'),
  ])

  // Build sections with tasks + cells
  const sectionsWithTasks: SectionWithTasks[] = ((sections as Section[]) ?? []).map(sec => ({
    ...sec,
    tasks: ((tasks as Task[]) ?? [])
      .filter(t => t.section_id === sec.id)
      .map(task => ({
        ...task,
        cells: ((cells as TaskCell[]) ?? []).filter(c => c.task_id === task.id)
      }))
  }))

  return <GanttPage initialSections={sectionsWithTasks} initialMilestones={(milestones as Milestone[]) ?? []} />
}
