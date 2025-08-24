
'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { PlusCircle, MessageSquare, Paperclip, Check, X, CheckSquare, Square, Trash2, Mic, StopCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { useAuth } from '@/context/auth-context';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { type Socket } from 'socket.io-client';

type TaskStatus = 'todo' | 'inProgress' | 'done';
type Team = 'general' | 'design' | 'frontend' | 'backend';

type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type Update = {
  id: string;
  type: 'text' | 'checklist' | 'voice' | 'file';
  content: string | ChecklistItem[] | { url: string; duration: number } | { url: string, name: string, size: string };
  author: string;
  timestamp: Date;
};

export type Task = {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  assignee: { name: string; avatar: string };
  progress: number;
  dueDate: Date;
  team: Team;
  updates: Update[];
  pendingUpdate?: {
    title: string;
    progress: number;
  } | null;
};

const priorityColors = {
  High: 'bg-red-500 hover:bg-red-600',
  Medium: 'bg-yellow-500 hover:bg-yellow-600',
  Low: 'bg-green-500 hover:bg-green-600',
};

const TaskCard = ({ task, socket }: { task: Task; socket: Socket | null; }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [updatedTitle, setUpdatedTitle] = useState(task.title);
  const [updatedProgress, setUpdatedProgress] = useState(task.progress);
  const [updateText, setUpdateText] = useState('');
  
  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  // File attachment state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{name: string, size: string, url: string} | null>(null);

  const { toast } = useToast();

  const handleTitleProgressSubmit = async () => {
    if (!socket) return;
    const updateData: Partial<Task> = {
      title: updatedTitle,
      progress: updatedProgress
    };
    if (user?.role === 'admin') {
      socket.emit('update-task', { taskId: task.id, updates: updateData });
      toast({ title: "Task Updated", description: "The task has been updated successfully." });
    } else {
      socket.emit('update-task', { taskId: task.id, updates: { pendingUpdate: { title: updatedTitle, progress: updatedProgress }}});
      toast({ title: "Update Submitted", description: "Your task title/progress update is pending admin approval." });
    }
  };

  const handleApprove = async () => {
    if(task.pendingUpdate && socket) {
        socket.emit('update-task', { 
            taskId: task.id, 
            updates: {
                title: task.pendingUpdate.title,
                progress: task.pendingUpdate.progress,
                pendingUpdate: null
            }
        });
        toast({ title: "Update Approved", description: "The task has been updated." });
    }
  }
  
  const handleReject = async () => {
    if (socket) {
        socket.emit('update-task', { taskId: task.id, updates: { pendingUpdate: null }});
        toast({ variant: 'destructive', title: "Update Rejected", description: "The pending update has been rejected." });
    }
  }

  const addChecklistItem = () => {
    if (newChecklistItem.trim() !== '') {
      setChecklistItems([...checklistItems, { id: Date.now().toString(), text: newChecklistItem, completed: false }]);
      setNewChecklistItem('');
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };
  
  const removeChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter(item => item.id !== id));
  };


  const handleAddUpdate = (type: Update['type']) => {
    let content: Update['content'] | null = null;
    let description = "Progress update added.";

    switch(type) {
      case 'text':
        if(updateText.trim() === '') return;
        content = updateText;
        description = "Text update added.";
        break;
      case 'checklist':
        if(checklistItems.length === 0) return;
        content = checklistItems;
        description = "Checklist added.";
        break;
      case 'voice':
        if(!audioUrl) return;
        const duration = Date.now() - recordingStartTimeRef.current;
        content = { url: audioUrl, duration };
        description = "Voice note added.";
        break;
      case 'file':
        if(!attachedFile) return;
        content = attachedFile;
        description = "File attached.";
        break;
    }

    if(content && user && socket) {
        socket.emit('add-update-to-task', {
            taskId: task.id,
            update: {
                id: Date.now().toString(),
                type,
                content,
                author: user.username,
                timestamp: new Date()
            }
        });
        toast({ title: "Update Added", description });
        
        // Reset inputs
        setUpdateText('');
        setChecklistItems([]);
        setAudioUrl(null);
        setAttachedFile(null);
    }
  }


  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = event => {
            audioChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setAudioUrl(audioUrl);
        };
        mediaRecorderRef.current.start();
        recordingStartTimeRef.current = Date.now();
        setIsRecording(true);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Could not start recording', description: 'Please ensure microphone permissions are granted.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
         setAttachedFile({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            url: url,
        });
      };
      reader.readAsDataURL(file);
    }
  }

  const attachments = task.updates.filter(u => u.type === 'file').length;
  const comments = task.updates.filter(u => u.type === 'text' || u.type === 'voice' || u.type === 'checklist').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="mb-4 cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow duration-200 bg-card">
          {task.pendingUpdate && <div className="w-full h-1 bg-yellow-400 rounded-t-lg"></div>}
          <CardContent className="p-4">
            <p className="font-medium mb-2">{task.title}</p>
             {task.pendingUpdate && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold mb-2">Pending Approval: "{task.pendingUpdate.title}" at {task.pendingUpdate.progress}%</p>
            )}
            <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>{comments}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Paperclip className="w-4 h-4" />
                  <span>{attachments}</span>
                </div>
                 <Badge variant="outline" className="capitalize">{task.team}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-white text-xs ${
                    priorityColors[task.priority as keyof typeof priorityColors]
                  }`}
                >
                  {task.priority}
                </Badge>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
                  <AvatarFallback>{task.assignee.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            {task.progress !== undefined && (
              <div className="flex items-center gap-2">
                  <Progress value={task.progress} className="w-[80%]" />
                  <span className="text-xs text-muted-foreground">{task.progress}%</span>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            {task.title}
            <Badge variant="secondary" className="capitalize text-sm">{task.team}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
           {task.pendingUpdate && user?.role === 'admin' && (
              <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
                  <CardHeader>
                      <CardTitle className="text-base text-yellow-800 dark:text-yellow-300">Pending Approval</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                      <p><strong>New Title:</strong> {task.pendingUpdate.title}</p>
                      <p><strong>New Progress:</strong> {task.pendingUpdate.progress}%</p>
                      <div className="flex gap-2 pt-2">
                          <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={handleApprove}><Check className="mr-2 h-4 w-4"/>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={handleReject}><X className="mr-2 h-4 w-4" />Reject</Button>
                      </div>
                  </CardContent>
              </Card>
            )}
          
          <Card>
            <CardHeader><CardTitle className="text-lg">Title & Progress</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div>
                <Label htmlFor="task-title">Title</Label>
                <Input id="task-title" value={updatedTitle} onChange={(e) => setUpdatedTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="task-progress">Progress ({updatedProgress}%)</Label>
                <Slider
                    id="task-progress"
                    min={0} 
                    max={100} 
                    step={5} 
                    value={[updatedProgress]}
                    onValueChange={(val) => setUpdatedProgress(val[0])}
                />
              </div>
              <Button onClick={handleTitleProgressSubmit}>Submit Title/Progress Update</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle className="text-lg">Add Progress Update</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Text Update */}
              <div>
                <Label>Text Update</Label>
                <Textarea placeholder="Add a comment or update..." value={updateText} onChange={(e) => setUpdateText(e.target.value)} />
                <Button className="mt-2" size="sm" onClick={() => handleAddUpdate('text')} disabled={!updateText}>Add Text</Button>
              </div>

              {/* Checklist Update */}
              <div>
                <Label>Checklist</Label>
                <div className="space-y-2 mt-2">
                  {checklistItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox id={`item-${item.id}`} checked={item.completed} onCheckedChange={() => toggleChecklistItem(item.id)} />
                      <Label htmlFor={`item-${item.id}`} className={`flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeChecklistItem(item.id)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input placeholder="New checklist item" value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} />
                  <Button onClick={addChecklistItem} disabled={!newChecklistItem}>Add Item</Button>
                </div>
                <Button className="mt-2" size="sm" onClick={() => handleAddUpdate('checklist')} disabled={checklistItems.length === 0}>Add Checklist</Button>
              </div>

              {/* Voice Note Update */}
              <div>
                <Label>Voice Note</Label>
                <div className="flex items-center gap-2 mt-2">
                    <Button onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? 'destructive' : 'outline'} size="icon">
                        {isRecording ? <StopCircle /> : <Mic />}
                    </Button>
                    {isRecording && <p className="text-sm text-muted-foreground">Recording...</p>}
                    {audioUrl && <audio src={audioUrl} controls />}
                </div>
                <Button className="mt-2" size="sm" onClick={() => handleAddUpdate('voice')} disabled={!audioUrl}>Add Voice Note</Button>
              </div>

              {/* File Attachment */}
              <div>
                  <Label>File Attachment</Label>
                  <div className="flex items-center gap-2 mt-2">
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Paperclip className="mr-2 h-4 w-4" /> Choose File
                      </Button>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                      {attachedFile && <p className="text-sm text-muted-foreground">{attachedFile.name}</p>}
                  </div>
                   <Button className="mt-2" size="sm" onClick={() => handleAddUpdate('file')} disabled={!attachedFile}>Add Attachment</Button>
              </div>

            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle className="text-lg">Update History</CardTitle></CardHeader>
            <CardContent>
              {task.updates.length > 0 ? (
                  <ul className="space-y-4">
                    {[...task.updates].reverse().map(update => (
                        <li key={update.id} className="text-sm">
                           <p className="font-semibold">{update.author} <span className="text-xs text-muted-foreground font-normal">at {new Date(update.timestamp).toLocaleString()}</span></p>
                          {update.type === 'text' && <p className="p-2 bg-muted rounded-md mt-1">{(update.content as string)}</p>}
                          {update.type === 'checklist' && (
                              <div className="p-2 bg-muted rounded-md mt-1 space-y-1">
                                {(update.content as ChecklistItem[]).map(item => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    {item.completed ? <CheckSquare className="h-4 w-4 text-primary"/> : <Square className="h-4 w-4 text-muted-foreground"/>}
                                    <span className={item.completed ? 'line-through text-muted-foreground' : ''}>{item.text}</span>
                                  </div>
                                ))}
                              </div>
                          )}
                          {update.type === 'voice' && <audio src={(update.content as {url: string}).url} controls className="mt-1" />}
                          {update.type === 'file' && <a href={(update.content as {url: string}).url} download={(update.content as {name: string}).name} className="flex items-center gap-2 p-2 bg-muted rounded-md mt-1 hover:bg-accent"><Paperclip className="h-4 w-4"/> {(update.content as {name: string}).name}</a>}
                        </li>
                    ))}
                  </ul>
              ) : (
                  <p className="text-muted-foreground text-sm">No updates for this task yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="ghost">Close</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddTaskDialog = ({ onAddTask }: { onAddTask: (task: Omit<Task, 'id' | 'updates' | 'assignee' | 'progress' | 'dueDate'>) => void }) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
    const [team, setTeam] = useState<Team>('general');
    const { toast } = useToast();

    const handleAddTask = () => {
        if (!title) {
             toast({ variant: 'destructive', title: "Task title is required." });
            return;
        }
        if (!team) {
            toast({ variant: 'destructive', title: "Please assign the task to a team."});
            return;
        }
        onAddTask({
            title,
            priority,
            team,
        });
        setTitle('');
        setPriority('Medium');
        setTeam('general');
        setOpen(false);
        toast({ title: "Task Added", description: "A new task has been added to the board." });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a New Task</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="new-task-title">Task Title</Label>
                        <Input id="new-task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Deploy to production"/>
                    </div>
                    <div>
                        <Label htmlFor="new-task-priority">Priority</Label>
                        <Select onValueChange={(val: 'High' | 'Medium' | 'Low') => setPriority(val)} defaultValue={priority}>
                            <SelectTrigger id="new-task-priority">
                                <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="new-task-team">Assign to Team</Label>
                        <Select onValueChange={(val: Team) => setTeam(val)} defaultValue={team}>
                            <SelectTrigger id="new-task-team">
                                <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="design">Design</SelectItem>
                                <SelectItem value="frontend">Frontend</SelectItem>
                                <SelectItem value="backend">Backend</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                     <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddTask}>Add Task</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const KanbanColumn = ({
  title,
  tasks,
  socket,
}: {
  title: string;
  tasks: Task[];
  socket: Socket | null;
}) => (
  <div className="w-full md:w-1/3 bg-muted/50 rounded-lg p-4">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Badge variant="secondary">{tasks.length}</Badge>
    </div>
    <div className="space-y-4 h-[calc(100vh-18rem)] overflow-y-auto pr-2">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} socket={socket} />
      ))}
    </div>
  </div>
);

const getStatusFromProgress = (progress: number): TaskStatus => {
    if (progress === 100) return 'done';
    if (progress > 0) return 'inProgress';
    return 'todo';
}

export default function KanbanBoard({ tasks, setTasks, socket }: { tasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>>, socket: Socket | null;}) {
  const { user } = useAuth();
  
  const handleAddTask = async (newTaskData: Omit<Task, 'id' | 'updates' | 'assignee' | 'progress' | 'dueDate'>) => {
      if (!socket) return;
      const fullTask = {
          ...newTaskData,
          assignee: { name: 'David', avatar: 'https://placehold.co/32x32.png' },
          progress: 0,
          dueDate: new Date(),
      }
      socket.emit('add-task', fullTask);
  };

  const categorizedTasks = useMemo(() => {
    const tasksWithDates = tasks.map(t => ({...t, dueDate: new Date(t.dueDate)}));
    return {
        todo: tasksWithDates.filter(t => getStatusFromProgress(t.progress) === 'todo'),
        inProgress: tasksWithDates.filter(t => getStatusFromProgress(t.progress) === 'inProgress'),
        done: tasksWithDates.filter(t => getStatusFromProgress(t.progress) === 'done'),
    }
  }, [tasks]);

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Task Board</h1>
            {user && <AddTaskDialog onAddTask={handleAddTask}/>}
        </div>
        <div className="flex flex-col md:flex-row gap-6">
            <KanbanColumn title="To Do" tasks={categorizedTasks.todo} socket={socket} />
            <KanbanColumn title="In Progress" tasks={categorizedTasks.inProgress} socket={socket} />
            <KanbanColumn title="Done" tasks={categorizedTasks.done} socket={socket} />
        </div>
    </div>
  );
}
