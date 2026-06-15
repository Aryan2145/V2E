'use client'

import React from 'react'
import TaskModuleSidebar from '@/components/layout/TaskModuleSidebar'

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)] -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <TaskModuleSidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
