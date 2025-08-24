
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Paperclip, Send, Hash, Video, User, FileText } from 'lucide-react';
import { Badge } from './ui/badge';
import VideoConference from './video-conference';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { type ChatRecipient } from '@/lib/types';
import Image from 'next/image';
import { useAuth } from '@/context/auth-context';
import { type Socket } from 'socket.io-client';

const channels = [
  { id: 'channel-1', name: 'general', unread: 2, meeting: false },
  { id: 'channel-2', name: 'design-team', unread: 0, meeting: false },
  { id: 'channel-3', name: 'frontend-devs', unread: 5, meeting: false },
  { id: 'channel-4', name: 'backend-squad', unread: 0, meeting: false },
];

const directMessages = [
  { id: 'dm-1', name: 'Alice', online: true, avatar: 'https://placehold.co/40x40.png' },
  { id: 'dm-2', name: 'Bob', online: false, avatar: 'https://placehold.co/40x40.png' },
  { id: 'dm-3', name: 'Charlie', online: true, avatar: 'https://placehold.co/40x40.png' },
];

const ChatMessage = ({ msg, currentUser }: { msg: any; currentUser: string }) => {
  const isYou = msg.user.name === currentUser;
  const hasMention = msg.mentions?.includes(currentUser);

  return (
    <div className={`flex items-start gap-3 ${isYou ? 'flex-row-reverse' : ''}`}>
      <Avatar>
        <AvatarImage src={msg.user.avatar} alt={msg.user.name} />
        <AvatarFallback>{msg.user.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className={cn(
        'p-3 rounded-lg max-w-xs lg:max-w-md',
        {
          'bg-primary text-primary-foreground': isYou,
          'bg-yellow-200 dark:bg-yellow-800 border-yellow-400 border': hasMention,
          'bg-muted': !isYou && !hasMention
        }
      )}>
        <p className="font-semibold text-sm mb-1">{msg.user.name}</p>
        {msg.text && (
          <p className="text-sm whitespace-pre-wrap">{
              msg.text.split(' ').map((word: string, i: number) =>
                  word.startsWith('@') ? <strong key={i} className="text-primary-foreground font-bold bg-primary/20 px-1 rounded-sm">{word} </strong> : word + ' '
              )
          }</p>
        )}
        {msg.image && (
          <div className="mt-2">
            <Image
                src={msg.image}
                alt="attachment"
                width={300}
                height={200}
                className="rounded-md object-cover"
            />
          </div>
        )}
        {msg.file && (
          <a href="#" className="mt-2 bg-background/50 p-2 rounded-md flex items-center gap-2 hover:bg-background/70 transition-colors">
            <FileText className="h-6 w-6" />
            <div>
              <p className="text-sm font-medium">{msg.file.name}</p>
              <p className="text-xs text-muted-foreground">{msg.file.size}</p>
            </div>
          </a>
        )}
        <p className={`text-xs mt-2 ${isYou ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  );
};


export default function ChatPanel({
  initialChat,
  socket,
}: {
  initialChat?: ChatRecipient;
  socket: Socket | null;
}) {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState<ChatRecipient>(
    initialChat || { id: 'channel-1', name: 'general', type: 'channel' }
  );
  const [inVideoCall, setInVideoCall] = useState(false);
  const [messages, setMessages] = useState<{ [key: string]: any[] }>({});
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mention state
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const mentionableUsers = [...directMessages, { id: user?.username, name: user?.username || 'You', avatar: 'https://placehold.co/40x40.png' }];
  const filteredUsers = mentionableUsers.filter(u => u.name?.toLowerCase().includes(mentionQuery.toLowerCase()));

  const currentMessages = messages[activeChat.id] || [];
  
  useEffect(() => {
    if(socket) {
        socket.on('initial-messages', (allMessages: { [key: string]: any[] }) => {
            setMessages(allMessages);
        });

        socket.on('meeting-started', ({channelId, channelName}) => {
             if(channelId === activeChat.id) {
                const systemMessage = {
                    id: Date.now(),
                    user: { name: 'System', avatar: '' },
                    text: `A meeting has started in #${channelName}`,
                    timestamp: new Date().toISOString(),
                    channelId: channelId,
                };
                setMessages(prev => ({
                    ...prev,
                    [channelId]: [...(prev[channelId] || []), systemMessage]
                }));
            }
        })
    }
    return () => {
        socket?.off('initial-messages');
        socket?.off('meeting-started');
    }
  }, [socket, activeChat.id]);

  useEffect(() => {
    if (initialChat) {
      setActiveChat(initialChat);
    }
    setNewMessage('');
  }, [initialChat]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeChat.id]);

  const sendMessage = (messageData: Partial<any>) => {
    if (!user || !socket) return;

    const mentionRegex = /@(\w+)/g;
    const mentions = messageData.text?.match(mentionRegex)?.map((m: string) => m.substring(1)) || [];
    
    const messageToSend = {
      user: { name: user.username, avatar: 'https://placehold.co/40x40.png' },
      mentions,
      channelId: activeChat.id,
      ...messageData,
    };
    
    socket.emit('send-message', messageToSend);
  };

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;
    sendMessage({ text: newMessage });
    setNewMessage('');
    setShowMentionPopover(false);
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        sendMessage({ image: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      sendMessage({
        file: {
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          type: file.type,
        }
      });
    }

    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    const lastWord = text.split(' ').pop() || '';
    if(lastWord.startsWith('@')) {
        setShowMentionPopover(true);
        setMentionQuery(lastWord.substring(1));
    } else {
        setShowMentionPopover(false);
    }
  };

  const handleMentionSelect = (name: string) => {
    const words = newMessage.split(' ');
    words.pop();
    setNewMessage([...words, `@${name}`].join(' ') + ' ');
    setShowMentionPopover(false);
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentionPopover) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const [currentChannelState, setCurrentChannelState] = useState(channels.find(c => c.id === activeChat.id));

  const handleCreateMeeting = () => {
    setCurrentChannelState(prev => prev ? {...prev, meeting: true} : undefined);
    setInVideoCall(true);
    if(socket) {
        socket.emit('start-meeting', { channelId: activeChat.id, channelName: activeChat.name });
    }
  };

  const handleJoinMeeting = () => {
    setInVideoCall(true);
  };
  
  const handleLeaveCall = () => {
    setInVideoCall(false);
  };

  if (inVideoCall) {
    return <VideoConference onLeave={handleLeaveCall} channelName={activeChat.name} socket={socket} />;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <div className="w-64 bg-muted/50 p-4 flex-col hidden md:flex rounded-l-lg">
        <h2 className="text-lg font-semibold mb-4">Channels</h2>
        <ul className="space-y-2 mb-6">
          {channels.map((channel) => (
            <li key={channel.id}>
              <Button
                variant={activeChat.id === channel.id ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveChat({ id: channel.id, name: channel.name, type: 'channel' })}
              >
                <Hash className="h-4 w-4 mr-2" />
                {channel.name}
                {channel.unread > 0 && (
                  <Badge className="ml-auto">{channel.unread}</Badge>
                )}
              </Button>
            </li>
          ))}
        </ul>
        <h2 className="text-lg font-semibold mb-4">Direct Messages</h2>
        <ul className="space-y-2">
          {directMessages.map((dm) => (
            <li key={dm.id}>
              <Button
                variant={activeChat.id === dm.id ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveChat({ id: dm.id, name: dm.name, type: 'dm' })}
              >
                <span className={`h-2 w-2 rounded-full mr-2 ${dm.online ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {dm.name}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 flex flex-col bg-card rounded-r-lg border">
        <div className="border-b p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center">
                {activeChat.type === 'channel' ? <Hash className="h-5 w-5 mr-2 text-muted-foreground" /> : <User className="h-5 w-5 mr-2 text-muted-foreground" />}
                {activeChat.name}
            </h2>
          {activeChat.type === 'channel' && (
            <Button 
                variant={currentChannelState?.meeting ? "destructive" : "outline"} 
                onClick={currentChannelState?.meeting ? handleJoinMeeting : handleCreateMeeting}>
                <Video className="h-4 w-4 mr-2" />
                {currentChannelState?.meeting ? "Join Meeting" : "Start Meeting"}
            </Button>
          )}
        </div>

        <div ref={chatContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto">
          {currentMessages.length > 0 ? currentMessages.map((msg, idx) => (
            <ChatMessage key={msg.id || idx} msg={msg} currentUser={user?.username || 'You'} />
          )) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>No messages in {activeChat.type === 'channel' ? '#' : ''}{activeChat.name} yet.</p>
              <p className="text-sm">Be the first to say something!</p>
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-background/50">
          <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <Input
                        id="chat-input"
                        placeholder={`Message ${activeChat.type === 'channel' ? '#' : ''}${activeChat.name}`}
                        className="pr-24"
                        value={newMessage}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                    />
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center">
                      <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                          <Paperclip className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleSendMessage}>
                          <Send className="h-5 w-5" />
                      </Button>
                  </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                <div className="flex flex-col gap-1 p-2">
                    {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <Button
                            key={u.id}
                            variant="ghost"
                            className="w-full justify-start gap-2"
                            onClick={() => handleMentionSelect(u.name!)}
                        >
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={u.avatar} alt={u.name} />
                                <AvatarFallback>{u.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{u.name}</span>
                        </Button>
                    )) : <p className="p-4 text-center text-sm text-muted-foreground">No users found.</p>}
                </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
