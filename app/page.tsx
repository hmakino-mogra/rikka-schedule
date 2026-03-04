import { supabase } from '@/lib/supabase'
import { GanttPage } from '@/components/GanttPage'
import type { SectionWithTasks, TaskWithCells, Section, Task, TaskCell, Milestone, Comment } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [{ data: sections }, { data: tasks }, { data: cells }, { data: milestones }, { data: comments }] = await Promise.all([
    supabase.from('sections').select('*').order('sort_order'),
    supabase.from('tasks').select('*').order('sort_order'),
    supabase.from('task_cells').select('*'),
    supabase.from('milestones').select('*'),
    supabase.from('comments').select('task_id, month_id, id, text, author, created_at'),
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

  // Build comment map: key = "taskId-monthId" → Comment[]
  const commentMap: Record<string, Comment[]> = {}
  for (const c of ((comments as Comment[]) ?? [])) {
    const key = `${c.task_id}-${c.month_id}`
    if (!commentMap[key]) commentMap[key] = []
    commentMap[key].push(c)
  }

  return <GanttPage initialSections={sectionsWithTasks} initialMilestones={(milestones as Milestone[]) ?? []} initialCommentMap={commentMap} />
}
