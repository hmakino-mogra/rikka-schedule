export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      sections: {
        Row: {
          id: string
          name: string
          color: string
          is_sub: boolean
          sort_order: number
          is_open: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sections']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          section_id: string
          name: string
          due_date: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      task_cells: {
        Row: {
          id: string
          task_id: string
          month_id: number
          content: string | null
          assignee: string | null
          memo: string | null
          cell_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_cells']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['task_cells']['Insert']>
      }
      milestones: {
        Row: {
          month_id: number
          text: string
          is_main: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['milestones']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>
      }
      comments: {
        Row: {
          id: string
          task_id: string
          month_id: number
          text: string
          author: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
    }
  }
}

// ── アプリ内で使う型 ──────────────────────────────────────────

export type Section  = Database['public']['Tables']['sections']['Row']
export type Task     = Database['public']['Tables']['tasks']['Row']
export type TaskCell = Database['public']['Tables']['task_cells']['Row']
export type Milestone = Database['public']['Tables']['milestones']['Row']
export type Comment  = Database['public']['Tables']['comments']['Row']

export interface TaskWithCells extends Task {
  cells: TaskCell[]
}
export interface SectionWithTasks extends Section {
  tasks: TaskWithCells[]
}

export const MONTHS = [
  { id: 1,  label: 'R7.10', year: 2025, month: 10 },
  { id: 2,  label: 'R7.11', year: 2025, month: 11 },
  { id: 3,  label: 'R7.12', year: 2025, month: 12 },
  { id: 4,  label: 'R8.1',  year: 2026, month: 1  },
  { id: 5,  label: 'R8.2',  year: 2026, month: 2  },
  { id: 6,  label: 'R8.3',  year: 2026, month: 3  },
  { id: 7,  label: 'R8.4',  year: 2026, month: 4  },
  { id: 8,  label: 'R8.5',  year: 2026, month: 5  },
  { id: 9,  label: 'R8.6',  year: 2026, month: 6  },
  { id: 10, label: 'R8.7',  year: 2026, month: 7  },
  { id: 11, label: 'R8.8',  year: 2026, month: 8  },
  { id: 12, label: 'R8.9',  year: 2026, month: 9  },
  { id: 13, label: 'R8.10', year: 2026, month: 10, isMain: true },
] as const

export const CURRENT_MONTH_ID = 5  // R8.2 = 2026年2月

export function toReiwa(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const ry = d.getFullYear() - 2018
  return `R${ry}.${d.getMonth() + 1}.${d.getDate()}`
}
export function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}
