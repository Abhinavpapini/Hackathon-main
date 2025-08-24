
'use client';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import React, { useState, useMemo } from 'react';
import { type Task } from '@/components/kanban-board';
import { useAuth } from '@/context/auth-context';
import { Button } from './ui/button';
import { PlusCircle, Calendar as CalendarIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


const channels = [
  { id: 'channel-1', name: 'general' },
  { id: 'channel-2', name: 'design-team' },
  { id: 'channel-3', name: 'frontend-devs' },
  { id: 'channel-4', name: 'backend-squad' },
];

const initialStaticEvents = [
    { date: new Date(new Date().setDate(new Date().getDate() + 1)), title: "Project Kick-off Meeting", type: "meeting" as const, channels: ['general', 'design-team'] },
    { date: new Date(new Date().setDate(new Date().getDate() + 5)), title: "Q3 Planning Session", type: "meeting" as const, channels: ['general', 'frontend-devs', 'backend-squad'] },
    { date: new Date(new Date().setDate(new Date().getDate() + 5)), title: "Frontend Feature Review", type: "review" as const, channels: ['frontend-devs'] },
];


const AddEventDialog = ({ onAddEvent }: { onAddEvent: (event: any) => void }) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState<Date | undefined>();
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const { toast } = useToast();

    const handleAddEvent = () => {
        if (!title || !date || selectedChannels.length === 0) {
            toast({ variant: 'destructive', title: "Please fill all fields" });
            return;
        }

        onAddEvent({
            title,
            date,
            type: 'meeting', // Defaulting to meeting for now
            channels: selectedChannels,
        });
        
        // Reset form
        setTitle('');
        setDate(undefined);
        setSelectedChannels([]);
        setOpen(false);
        toast({ title: "Event Added", description: "The new event has been added to the calendar." });
    };

    const toggleChannel = (channelName: string) => {
        setSelectedChannels(prev => 
            prev.includes(channelName) 
            ? prev.filter(c => c !== channelName)
            : [...prev, channelName]
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Event
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a New Event</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="event-title">Event Title</Label>
                        <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Team Sync"/>
                    </div>
                     <div>
                        <Label htmlFor="event-date">Event Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={date}
                              onSelect={setDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <Label>Assign to Channels</Label>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {channels.map(channel => (
                                <Button 
                                    key={channel.id} 
                                    variant={selectedChannels.includes(channel.name) ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => toggleChannel(channel.name)}
                                    className="capitalize"
                                >
                                    {channel.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                     <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddEvent}>Add Event</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function CalendarView({ allTasks }: { allTasks: Task[]}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  const taskEvents = useMemo(() => allTasks.map(task => ({
      date: new Date(task.dueDate),
      title: task.title,
      type: 'deadline' as const,
      channels: [task.team]
  })), [allTasks]);

  const [staticEvents, setStaticEvents] = useState(initialStaticEvents);

  const allEvents = useMemo(() => [...staticEvents, ...taskEvents], [staticEvents, taskEvents]);

  const badgeColors = {
      meeting: 'bg-blue-500',
      deadline: 'bg-red-500',
      review: 'bg-green-500'
  }

  const handleAddEvent = (newEvent: any) => {
    setStaticEvents(prev => [...prev, newEvent]);
  }

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return allEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.toDateString() === selectedDate.toDateString();
    });
  }, [selectedDate, allEvents]);


  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= today;
    }).sort((a,b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    }).slice(0, 5);
  }, [allEvents]);


  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Calendar</h1>
            {user?.role === 'admin' && <AddEventDialog onAddEvent={handleAddEvent} />}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardContent className="p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="w-full"
                            modifiers={{
                                event: allEvents.map(e => new Date(e.date))
                            }}
                            modifiersStyles={{
                                event: {
                                    backgroundColor: 'hsl(var(--primary))',
                                    color: 'hsl(var(--primary-foreground))',
                                    borderRadius: '9999px',
                                }
                            }}
                        />
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {selectedDate ? `Events for ${format(selectedDate, "PPP")}` : "Select a Date"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {selectedDayEvents.length > 0 ? (
                            <ul className="space-y-3">
                                {selectedDayEvents.map((event, index) => (
                                    <li key={index} className="flex items-center justify-between">
                                        <span>{event.title}</span>
                                        <Badge className={`${badgeColors[event.type as keyof typeof badgeColors]}`}>{event.type}</Badge>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground">
                                {selectedDate ? "No events for this day." : "Click a date to see events."}
                            </p>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Upcoming</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {upcomingEvents.map((event, index) => (
                                <li key={index} className="flex items-center justify-between">
                                    <div>
                                        <p>{event.title}</p>
                                        <p className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <Badge className={`${badgeColors[event.type as keyof typeof badgeColors]}`}>{event.type}</Badge>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
