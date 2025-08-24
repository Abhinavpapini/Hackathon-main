
import { type Task } from '@/components/kanban-board';

const getStatusFromProgress = (progress: number) => {
    if (progress === 100) return 'done';
    if (progress > 0) return 'inProgress';
    return 'todo';
}

export function categorizeTasks(tasks: Task[]) {
  return {
    todo: tasks.filter((t) => getStatusFromProgress(t.progress) === 'todo'),
    inProgress: tasks.filter((t) => getStatusFromProgress(t.progress) === 'inProgress'),
    done: tasks.filter((t) => getStatusFromProgress(t.progress) === 'done'),
  };
}

export function getUpcomingTasks(categorizedTasks: {
  todo: Task[];
  inProgress: Task[];
}) {
  return [...categorizedTasks.todo, ...categorizedTasks.inProgress].sort(
    (a, b) => {
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      return dateA.getTime() - dateB.getTime();
    }
  );
}
