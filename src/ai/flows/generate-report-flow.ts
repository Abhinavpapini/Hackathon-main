'use server';
/**
 * @fileOverview A flow for generating a weekly task summary report.
 *
 * - generateWeeklyReport - A function that takes task data and generates a report.
 * - ReportInput - The input type for the generateWeeklyReport function.
 * - ReportOutput - The return type for the generateWeeklyReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { type Task } from '@/components/kanban-board';

const UpdateSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'checklist', 'voice', 'file']),
  content: z.any(),
  author: z.string(),
  timestamp: z.string(),
});

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(['High', 'Medium', 'Low']),
  assignee: z.object({
    name: z.string(),
    avatar: z.string(),
  }),
  progress: z.number(),
  dueDate: z.string(),
  team: z.enum(['general', 'design', 'frontend', 'backend']),
  updates: z.array(UpdateSchema),
});

const ReportInputSchema = z.object({
  tasks: z.array(TaskSchema),
  currentDate: z.string().describe("The current date, to determine which week this report is for."),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
  report: z.string().describe('The full weekly report formatted in Markdown.'),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

export async function generateWeeklyReport(input: {tasks: Task[], currentDate: string}): Promise<ReportOutput> {
  const tasksWithIsoDates = input.tasks.map(task => ({
    ...task,
    dueDate: task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString() : new Date(task.dueDate).toISOString()) : new Date().toISOString(),
    updates: task.updates ? task.updates.map(update => ({
        ...update,
        timestamp: update.timestamp ? (update.timestamp instanceof Date ? update.timestamp.toISOString() : new Date(update.timestamp).toISOString()) : new Date().toISOString(),
        // Stringify content that is not a primitive
        content: typeof update.content === 'object' ? JSON.stringify(update.content) : update.content,
    })) : [],
  }));

  return generateWeeklyReportFlow({
      ...input,
      tasks: tasksWithIsoDates
  });
}


const prompt = ai.definePrompt({
  name: 'generateWeeklyReportPrompt',
  input: {schema: ReportInputSchema},
  output: {schema: ReportOutputSchema},
  prompt: `You are a project management assistant. Your task is to generate a comprehensive weekly progress report based on the provided list of tasks and their updates. The report should be well-structured, easy to read, and formatted in Markdown.

The current date is {{currentDate}}.

The report should include the following sections:
1.  **Overall Summary**: A brief overview of the team's progress this week. Mention key achievements, the number of completed tasks (progress is 100%), and any potential blockers identified from task updates.
2.  **Team Breakdown**: Provide a section for each team (design, frontend, backend, general).
    *   For each team, list the tasks they worked on.
    *   For each task, include its title, current progress percentage, assignee, priority, and due date.
    *   Determine the task status based on its progress: 0% is "To Do", 1-99% is "In Progress", and 100% is "Done".
    *   Summarize the updates for each task, mentioning who provided the update and when. For checklist updates, summarize the completion status. For voice/file updates, just note their presence.
3.  **Feedback and Peer Review**: A section summarizing feedback from the task updates. Highlight constructive comments and peer reviews from team members on different tasks.
4.  **Completed Tasks**: A list of all tasks that reached 100% progress this week.
5.  **Upcoming Priorities**: A look ahead at the key tasks for the upcoming week based on tasks that are not yet "Done".

Analyze the provided task and updates data to generate the content for each section.

Here is the task data:
{{#each tasks}}
---
- **Task**: {{title}} ({{progress}}%)
  - **Status**: {{#if (eq progress 100)}}Done{{else if (gt progress 0)}}In Progress{{else}}To Do{{/if}}
  - **Team**: {{team}}
  - **Assignee**: {{assignee.name}}
  - **Priority**: {{priority}}
  - **Due Date**: {{dueDate}}
  - **Updates**:
    {{#if updates}}
      {{#each updates}}
      - **{{author}}** ({{timestamp}}): {{#if (eq type 'text')}}'{{content}}'{{else if (eq type 'checklist')}}Updated a checklist.{{else if (eq type 'voice')}}Left a voice note.{{else if (eq type 'file')}}Attached a file.{{/if}}
      {{/each}}
    {{else}}
      No updates this week.
    {{/if}}
{{/each}}
`,
});

const generateWeeklyReportFlow = ai.defineFlow(
  {
    name: 'generateWeeklyReportFlow',
    inputSchema: ReportInputSchema,
    outputSchema: ReportOutputSchema,
  },
  async (input) => {
    // The input is already validated by the flow's definition.
    // The prompt expects Date objects to be handled correctly by the templating engine.
    const {output} = await prompt(input);
    return output!;
  }
);
