
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  MessageSquare,
  Send,
  Brush,
  Users,
  X,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import Whiteboard from './whiteboard';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { type Socket } from 'socket.io-client';
import { useAuth } from '@/context/auth-context';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  avatar: string;
}

const initialParticipants: Participant[] = [
  { id: '1', name: 'You', isMuted: true, isCameraOn: false, isScreenSharing: false, avatar: 'https://placehold.co/128x128.png' },
  { id: '2', name: 'Alice', isMuted: false, isCameraOn: true, isScreenSharing: false, avatar: 'https://placehold.co/128x128.png' },
  { id: '3', name: 'Bob', isMuted: false, isCameraOn: true, isScreenSharing: false, avatar: 'https://placehold.co/128x128.png' },
];


export default function VideoConference({
  onLeave,
  channelName = 'Team Standup',
  socket,
}: {
  onLeave?: () => void;
  channelName?: string;
  socket: Socket | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatTarget, setChatTarget] = useState('everyone');
  const [hasDeviceSupport, setHasDeviceSupport] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenShareStream = useRef<MediaStream | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const mainImageRef = useRef<HTMLImageElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);


  const you = participants.find((p) => p.name === 'You');

  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.mediaDevices) {
        setHasDeviceSupport(false);
        toast({
            variant: "destructive",
            title: "Insecure Connection",
            description: "Camera and microphone are disabled on non-secure (HTTP) connections. Please use localhost or HTTPS.",
            duration: 10000,
        });
        return;
    }

    if (socket && user) {
        socket.emit('user-joined-meeting', { channelId: socket.id, username: user.username });
    }

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        setHasCameraPermission(true);
        stream.getTracks().forEach(track => track.stop()); // stop tracks immediately, we will ask again
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
      }
    };

    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    getCameraPermission();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      screenShareStream.current?.getTracks().forEach(track => track.stop());
    }
  }, []);

  const updateStream = async () => {
    if (!you || !navigator.mediaDevices) return;

    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
            track.stop();
        });
        localStreamRef.current = null;
    }

    if (you.isCameraOn || !you.isMuted) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: you.isCameraOn,
                audio: !you.isMuted,
            });
            localStreamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            if (mainVideoRef.current) {
                mainVideoRef.current.srcObject = stream;
            }
             if (!you.isCameraOn) {
                stream.getVideoTracks().forEach(track => track.enabled = false);
            }
            if (you.isMuted) {
                stream.getAudioTracks().forEach(track => track.enabled = false);
            }

        } catch (error) {
            console.error("Error updating stream:", error);
            toast({
                variant: 'destructive',
                title: 'Device Access Error',
                description: 'Could not access camera or microphone.',
            });
            // Revert state if we fail to get the stream
            setParticipants(parts => parts.map(p => p.id === 'You' ? {...p, isCameraOn: false, isMuted: true } : p));
        }
    } else {
        if (videoRef.current) videoRef.current.srcObject = null;
        if (mainVideoRef.current) mainVideoRef.current.srcObject = null;
    }
  };

  const toggleMic = async () => {
    if (!hasDeviceSupport) return;
    const isMuted = !you?.isMuted;
    setParticipants(participants.map((p) =>
        p.name === 'You' ? { ...p, isMuted } : p
    ));
    if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !isMuted);
    } else if (!isMuted) {
       // If stream doesn't exist, and we want to unmute, we need to get it.
       try {
           const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
           localStreamRef.current = stream;
           stream.getAudioTracks().forEach(track => track.enabled = true);
           // We don't want to show video here, so no need to set srcObject
       } catch (error) {
           console.error("Error getting audio stream:", error);
           toast({
                variant: 'destructive',
                title: 'Device Access Error',
                description: 'Could not access microphone.',
            });
           setParticipants(parts => parts.map(p => p.id === 'You' ? {...p, isMuted: true } : p));
       }
    }
  };

  const toggleCamera = async () => {
    if (!hasDeviceSupport) return;
    const isCameraOn = !you?.isCameraOn;
     if (!isCameraOn) {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getVideoTracks().forEach(track => track.stop());
      }
       if (mainVideoRef.current && mainVideoRef.current.srcObject) {
        (mainVideoRef.current.srcObject as MediaStream).getVideoTracks().forEach(track => track.stop());
      }
       if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => track.stop());
          // If audio is also off, we can stop the whole stream
          if (you?.isMuted) {
              localStreamRef.current = null;
          }
      }
      setParticipants(participants.map(p => (p.name === 'You' ? { ...p, isCameraOn: false } : p)));
    } else {
      if (!hasCameraPermission) {
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        if (localStreamRef.current) {
            stream.getVideoTracks().forEach(track => localStreamRef.current?.addTrack(track));
        } else {
            localStreamRef.current = stream;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }
        if (mainVideoRef.current) {
            mainVideoRef.current.srcObject = localStreamRef.current;
        }
        setParticipants(participants.map(p => (p.name === 'You' ? { ...p, isCameraOn: true } : p)));
      } catch (error) {
        console.error("Error accessing camera:", error);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    }
  };


  const toggleScreenShare = async () => {
    if (!hasDeviceSupport) return;
    const anotherUserIsSharing = participants.some(p => p.id !== you?.id && p.isScreenSharing);
    
    if (you?.isScreenSharing) {
        if(screenShareStream.current) {
            screenShareStream.current.getTracks().forEach(track => track.stop());
            screenShareStream.current = null;
        }
        setParticipants(participants.map(p => p.name === 'You' ? { ...p, isScreenSharing: false } : p));
        if(you?.isCameraOn) {
            if (mainVideoRef.current) {
                mainVideoRef.current.srcObject = localStreamRef.current;
            }
        } else {
             if (mainImageRef.current) mainImageRef.current.style.display = 'block';
             if (mainVideoRef.current) mainVideoRef.current.style.display = 'none';
        }

    } else {
        if (anotherUserIsSharing) {
            toast({
                title: "Cannot Share Screen",
                description: "Another participant is already sharing their screen.",
                variant: 'destructive'
            });
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenShareStream.current = stream;
            setParticipants(participants.map(p => p.id === 'You' ? { ...p, isScreenSharing: true } : p));
            if(mainImageRef.current) mainImageRef.current.style.display = 'none';
            if (mainVideoRef.current) {
                mainVideoRef.current.style.display = 'block';
                mainVideoRef.current.srcObject = stream;
            }
            
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                setParticipants(parts => parts.map(p => p.id === 'You' ? { ...p, isScreenSharing: false } : p));
                screenShareStream.current = null;
                if(mainImageRef.current) mainImageRef.current.style.display = 'block';
                if (mainVideoRef.current) {
                    mainVideoRef.current.style.display = 'none';
                    if (you?.isCameraOn) {
                        mainVideoRef.current.style.display = 'block';
                        mainVideoRef.current.srcObject = localStreamRef.current;
                    }
                }
            });
        } catch (error) {
            console.error("Error starting screen share:", error);
            toast({
                title: 'Could not start screen share',
                description: 'Please ensure you have the necessary permissions.',
                variant: 'destructive'
            });
        }
    }
  };

  const toggleFullScreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
  };

  const handleLeaveCall = () => {
    if (socket && user) {
        socket.emit('user-left-meeting', { channelId: socket.id, username: user.username });
    }
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenShareStream.current?.getTracks().forEach(track => track.stop());
    if (onLeave) {
      onLeave();
    }
  };

  const handleSendChat = () => {
    if (chatInput.trim() === '') return;
    const newMessage = {
      sender: 'You',
      text: chatInput,
      target: chatTarget,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');
  };

  const mainScreenParticipant = participants.find(p => p.isScreenSharing) || participants.find(p => p.name === 'You' && p.isCameraOn) || participants.find(p => p.name !== 'You' && p.isCameraOn) || participants[0];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{channelName} Call</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-5 w-5" />
          <span>{participants.length} participants</span>
        </div>
      </div>
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex flex-col gap-4" ref={videoContainerRef}>
          <Card className="flex-1 w-full h-full relative overflow-hidden bg-muted">
            <CardContent className="p-0 w-full h-full flex items-center justify-center">
                
                <video ref={mainVideoRef} className="w-full h-full object-contain" autoPlay muted style={{ display: (mainScreenParticipant.name === 'You' && (you?.isCameraOn || you?.isScreenSharing)) ? 'block' : 'none' }}/>

                { mainScreenParticipant.name !== 'You' && mainScreenParticipant.isCameraOn &&
                   <img ref={mainImageRef} src={mainScreenParticipant.avatar} alt={mainScreenParticipant.name} className="w-full h-full object-cover" data-ai-hint="person video call" />
                }

                { !mainScreenParticipant.isCameraOn && !mainScreenParticipant.isScreenSharing && (
                    <Avatar className="h-32 w-32">
                    <AvatarImage src={mainScreenParticipant.avatar} alt={mainScreenParticipant.name}/>
                    <AvatarFallback className="text-5xl">{mainScreenParticipant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                )}

               <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">{mainScreenParticipant.name}</Badge>
              </div>
              <div className="absolute top-2 right-2">
                <Button variant="ghost" size="icon" onClick={toggleFullScreen}>
                    {isFullScreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
                </Button>
              </div>
            </CardContent>
          </Card>
           {!hasCameraPermission && (
            <Alert variant="destructive">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                Please allow camera access to use this feature.
                </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2 overflow-x-auto p-1">
             {participants.map((p) => (
                <Card key={p.id} className="relative overflow-hidden aspect-video w-48 flex-shrink-0">
                    <CardContent className="p-0 w-full h-full flex items-center justify-center bg-muted">
                        {p.name === 'You' && p.isCameraOn ? (
                             <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted />
                        ) : p.isCameraOn ? (
                            <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" data-ai-hint="person video call thumbnail" />
                        ) : (
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={p.avatar} alt={p.name} />
                                <AvatarFallback className="text-xl">{p.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        )}
                    </CardContent>
                    <div className="absolute top-1 right-1 flex items-center gap-1">
                      {p.isMuted && <MicOff className="h-4 w-4 text-white bg-black/50 p-0.5 rounded-full" />}
                      {p.isScreenSharing && <ScreenShare className="h-4 w-4 text-white bg-blue-500/80 p-0.5 rounded-full" />}
                    </div>
                    <div className="absolute bottom-1 left-1">
                      <Badge variant="secondary" className="text-xs">{p.name}</Badge>
                    </div>
                </Card>
             ))}
          </div>
        </div>
        
        {showWhiteboard && (
          <div className="w-1/3 flex-shrink-0">
            <Whiteboard />
          </div>
        )}
        
        {showChat && (
          <Card className="w-1/3 flex flex-col flex-shrink-0">
            <CardContent className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">In-call Messages</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowChat(false)}><X className="h-4 w-4"/></Button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                  {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-lg px-3 py-2 max-w-sm ${msg.sender === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <p className="text-xs font-semibold mb-1">{msg.sender} {msg.target !== 'everyone' && `(to ${msg.target})`}</p>
                              <p className="text-sm">{msg.text}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{msg.time}</p>
                      </div>
                  ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                />
                 <Select value={chatTarget} onValueChange={setChatTarget}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Send to" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      {participants.filter(p => p.name !== 'You').map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <Button onClick={handleSendChat} size="icon"><Send className="h-4 w-4"/></Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="mt-4 flex justify-center">
        <Card className="p-2 rounded-full shadow-lg">
          <CardContent className="flex items-center gap-2 p-1">
            <Button variant={you?.isMuted ? 'destructive' : 'secondary'} size="icon" className="rounded-full w-12 h-12" onClick={toggleMic} disabled={!hasDeviceSupport}>
              {you?.isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <Button variant={you?.isCameraOn ? 'default' : 'secondary'} size="icon" className="rounded-full w-12 h-12" onClick={toggleCamera} disabled={!hasDeviceSupport}>
              {you?.isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
            <Button variant={you?.isScreenSharing ? "default" : "secondary"} size="icon" className="rounded-full w-12 h-12" onClick={toggleScreenShare} disabled={!hasDeviceSupport}>
                {you?.isScreenSharing ? <ScreenShareOff className="h-6 w-6"/> : <ScreenShare className="h-6 w-6" />}
            </Button>
            <Button variant={showWhiteboard ? 'default' : 'secondary'} size="icon" className="rounded-full w-12 h-12" onClick={() => setShowWhiteboard(!showWhiteboard)}>
              <Brush className="h-6 w-6" />
            </Button>
            <Button variant={showChat ? 'default' : 'secondary'} size="icon" className="rounded-full w-12 h-12" onClick={() => setShowChat(!showChat)}>
              <MessageSquare className="h-6 w-6" />
            </Button>
            <Button size="icon" className="rounded-full w-12 h-12 bg-red-500 hover:bg-red-600" onClick={handleLeaveCall}>
              <PhoneOff className="h-6 w-6" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    