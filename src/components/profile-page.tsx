
'use client';

import React, { useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Camera, ClipboardCheck } from 'lucide-react';
import { type Task } from './kanban-board';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage({ tasks }: { tasks: Task[] }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const completedTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => task.progress === 100 && task.assignee.name === user.username);
    }, [tasks, user]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Here you would typically upload the file and update the user's avatar URL
            // For now, we'll just show a toast notification as a placeholder
            toast({
                title: 'Profile Picture Updated',
                description: `New picture "${file.name}" selected. (This is a demo and the image is not saved).`,
            });
        }
    };
    
    if (!user) {
        return <p>Please log in to view your profile.</p>;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex justify-between items-start">
                <div>
                <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
                <p className="text-muted-foreground">
                    View and manage your personal information.
                </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader className="items-center">
                            <div className="relative">
                                <Avatar className="h-32 w-32">
                                    <AvatarImage src={`https://placehold.co/128x128.png?text=${user.username.charAt(0).toUpperCase()}`} alt={user.username} />
                                    <AvatarFallback className="text-4xl">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <Button 
                                    size="icon" 
                                    className="absolute bottom-1 right-1 rounded-full h-8 w-8"
                                    onClick={handleAvatarClick}
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="text-center">
                            <h2 className="text-2xl font-bold">{user.username}</h2>
                            <p className="text-muted-foreground capitalize">{user.role}</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 text-primary" />
                                Completed Tasks
                            </CardTitle>
                            <CardDescription>
                                A list of all tasks you have successfully completed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {completedTasks.length > 0 ? (
                                <ul className="space-y-3">
                                    {completedTasks.map(task => (
                                        <li key={task.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                                            <div>
                                                <p className="font-medium">{task.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Completed on {task.dueDate.toLocaleDateString()}
                                                </p>
                                            </div>
                                            <Badge variant="secondary" className="capitalize">{task.team}</Badge>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">
                                    You haven't completed any tasks yet. Keep up the good work!
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
