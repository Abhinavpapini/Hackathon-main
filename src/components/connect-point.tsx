
'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardCheck,
  Calendar,
  Settings,
  HelpCircle,
  Sparkles,
  PanelLeft,
  FileText,
  User,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/user-nav';
import DashboardOverview from '@/components/dashboard-overview';
import KanbanBoard, { type Task } from '@/components/kanban-board';
import ChatPanel from '@/components/chat-panel';
import CalendarView from '@/components/calendar-view';
import ReportsView from '@/components/reports-view';
import ProfilePage from '@/components/profile-page';
import { type ChatRecipient } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { io, type Socket } from 'socket.io-client';


type View = 'dashboard' | 'tasks' | 'chat' | 'calendar' | 'settings' | 'help' | 'reports' | 'profile';

export default function ConnectPoint() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [initialChat, setInitialChat] = useState<ChatRecipient | undefined>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('tasks-updated', (updatedTasks: Task[]) => {
        setTasks(updatedTasks);
    });

    return () => {
      newSocket.off('tasks-updated');
      newSocket.disconnect();
    };
  }, []);

  const navigateToChat = (chat?: ChatRecipient) => {
    setInitialChat(chat);
    setActiveView('chat');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardOverview onNavigate={setActiveView} onNavigateToChat={navigateToChat} tasks={tasks} />;
      case 'tasks':
        return <KanbanBoard tasks={tasks} setTasks={setTasks} socket={socket} />;
      case 'chat':
        return <ChatPanel initialChat={initialChat} socket={socket} />;
      case 'calendar':
        return <CalendarView allTasks={tasks} />;
      case 'reports':
        return <ReportsView tasks={tasks} />;
      case 'profile':
        return <ProfilePage tasks={tasks} />;
      default:
        return <DashboardOverview onNavigate={setActiveView} onNavigateToChat={navigateToChat} tasks={tasks}/>;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const secondaryMenuItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ]

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarContent className="flex flex-col">
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="md:hidden" asChild>
                  <SidebarTrigger>
                    <PanelLeft />
                  </SidebarTrigger>
                </Button>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                  ConnectPoint
                </h1>
              </div>
            </SidebarHeader>
            <SidebarMenu className="flex-1 p-4">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveView(item.id as View)}
                    isActive={activeView === item.id}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarMenu className="p-4 mt-auto">
                <SidebarMenuItem>
                    <SidebarMenuButton
                        onClick={() => setActiveView('profile')}
                        isActive={activeView === 'profile'}
                    >
                        <User className="h-5 w-5" />
                        <span>My Profile</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveView(item.id as View)}
                    isActive={activeView === item.id}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-4 md:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <p className="text-sm font-medium">Welcome, {user.username}!</p>
            </div>
            <UserNav onProfileClick={() => setActiveView('profile')} />
          </header>
          <main className="flex-1 p-4 md:p-6">{renderContent()}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
