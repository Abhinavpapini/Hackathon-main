
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  ClipboardCheck,
  ArrowRight,
  Hash,
  Calendar,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Progress } from '@/components/ui/progress';
import { type ChatRecipient } from '@/lib/types';
import {
  categorizeTasks,
  getUpcomingTasks,
} from '@/lib/task-utils';
import { type Task } from './kanban-board';

type View = 'dashboard' | 'tasks' | 'chat' | 'calendar';

export default function DashboardOverview({
  onNavigate,
  onNavigateToChat,
  tasks
}: {
  onNavigate: (view: View) => void;
  onNavigateToChat: (chat: ChatRecipient) => void;
  tasks: Task[]
}) {
  const categorized = categorizeTasks(tasks);
  const upcomingTasks = getUpcomingTasks(categorized).slice(0, 4);

  const recentMessages = [
    {
      user: 'Alice',
      message: 'Can we sync up about the new designs?',
      channel: 'design-team',
      channelId: 'channel-2',
      type: 'channel' as const,
    },
    {
      user: 'Bob',
      message: 'I have a question about the CI/CD pipeline setup.',
      channel: 'general',
      channelId: 'channel-1',
      type: 'channel' as const,
    },
    {
      user: 'Charlie',
      message: "Hey, how's the auth flow coming along?",
      channel: 'Charlie',
      channelId: 'dm-3',
      type: 'dm' as const,
    },
  ];

  const handleMessageClick = (msg: (typeof recentMessages)[0]) => {
    onNavigateToChat({
      id: msg.channelId,
      name: msg.channel,
      type: msg.type,
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's a summary of your workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
         <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    <span>Your Tasks</span>
                </CardTitle>
                <CardDescription>Tasks with the nearest deadlines.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                {upcomingTasks.map((task) => (
                    <div key={task.id} className="group">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-medium group-hover:text-primary transition-colors">{task.title}</p>
                          <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                  {new Date(task.dueDate).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}
                              </Badge>
                          </div>
                        </div>
                        <Progress value={task.progress} className="h-2" />
                    </div>
                ))}
            </CardContent>
            <CardFooter>
                <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate('tasks')}>
                    View All Tasks <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span>Recent Activity</span>
                </CardTitle>
                <CardDescription>Latest messages from your team.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <ul className="space-y-4">
                    {recentMessages.map((msg, index) => (
                        <li
                            key={index}
                            className="flex items-start gap-3 cursor-pointer group"
                            onClick={() => handleMessageClick(msg)}
                        >
                            <Avatar className="h-9 w-9 border-2 border-transparent group-hover:border-primary transition-all">
                                <AvatarFallback>
                                    {msg.type === 'channel' ? (
                                        <Hash className="h-4 w-4" />
                                    ) : (
                                        msg.user.charAt(0)
                                    )}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                                    {msg.user}{' '}
                                    <span className="text-xs text-muted-foreground font-normal">
                                        in #{msg.channel}
                                    </span>
                                </p>
                                <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                                    {msg.message}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </CardContent>
             <CardFooter>
                <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate('chat')}>
                    Go to Chat <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>

         <Card className="flex flex-col justify-between bg-primary/10 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <Calendar className="h-5 w-5" />
                    <span>Calendar</span>
                </CardTitle>
                <CardDescription>Check your upcoming events.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center">
                    <p className="text-6xl font-bold text-primary">{new Date().getDate()}</p>
                    <p className="text-lg text-muted-foreground">{new Date().toLocaleString('default', { month: 'long' })}</p>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" size="sm" className="w-full bg-background" onClick={() => onNavigate('calendar')}>
                    View Calendar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}
