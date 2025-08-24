
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { MongoClient, ObjectId, ChangeStream, Collection } from 'mongodb';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable');
}
if (!dbName) {
  throw new Error('Please define the DB_NAME environment variable');
}

const client = new MongoClient(uri);
let chatMessagesCollection: Collection<any>;
let tasksCollection: Collection<any>;

const initialTasks = [
    {
      title: 'Design final UI mockups for the new landing page',
      priority: 'High' as const,
      assignee: { name: 'Alice', avatar: 'https://placehold.co/32x32.png' },
      progress: 15,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 2)),
      team: 'design' as const,
      updates: [],
      pendingUpdate: null,
    },
    {
      title: 'Setup CI/CD pipeline',
      priority: 'Medium' as const,
      assignee: { name: 'Bob', avatar: 'https://placehold.co/32x32.png' },
      progress: 0,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 5)),
      team: 'backend' as const,
      updates: [],
      pendingUpdate: null,
    },
    {
      title: 'Develop user authentication flow',
      priority: 'High' as const,
      assignee: { name: 'Charlie', avatar: 'https://placehold.co/32x32.png' },
      progress: 75,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      team: 'frontend' as const,
      updates: [],
      pendingUpdate: null,
    },
    {
      title: 'Initial project setup and dependency installation',
      priority: 'Low' as const,
      assignee: { name: 'David', avatar: 'https://placehold.co/32x32.png' },
      progress: 100,
      dueDate: new Date(new Date().setDate(new Date().getDate() - 2)),
      team: 'general' as const,
      updates: [],
      pendingUpdate: null,
    },
];

const initialMessages = [
    {
        user: { name: 'System', avatar: '' },
        text: 'Welcome to ConnectPoint! This is the #general channel.',
        timestamp: new Date(),
        channelId: 'channel-1',
    }
]

async function seedDatabase() {
    const taskCount = await tasksCollection.countDocuments();
    if (taskCount === 0) {
        console.log("Seeding tasks...");
        await tasksCollection.insertMany(initialTasks);
    }

    const messageCount = await chatMessagesCollection.countDocuments();
    if (messageCount === 0) {
        console.log("Seeding messages...");
        await chatMessagesCollection.insertMany(initialMessages);
    }
}


async function connectToDb() {
  await client.connect();
  const db = client.db(dbName);
  chatMessagesCollection = db.collection('chatMessages');
  tasksCollection = db.collection('tasks');
  console.log('Connected to MongoDB');
  await seedDatabase();
}

const watchForChanges = (io: Server) => {
  try {
    const chatChangeStream = chatMessagesCollection.watch();
    chatChangeStream.on('change', async () => {
      const messages = await chatMessagesCollection.find({}).sort({ timestamp: 1 }).toArray();
      const groupedMessages = messages.reduce((acc: any, msg: any) => {
          const key = msg.channelId;
          if (!acc[key]) {
              acc[key] = [];
          }
          acc[key].push({ ...msg, id: msg._id.toString()});
          return acc;
      }, {});
      io.emit('initial-messages', groupedMessages);
    });

    chatChangeStream.on('error', (error) => {
      console.log('Chat change stream error (real-time updates disabled):', error.message);
    });

    const taskChangeStream = tasksCollection.watch();
    taskChangeStream.on('change', async () => {
      const tasks = await tasksCollection.find({}).toArray();
      io.emit('tasks-updated', tasks.map(t => ({...t, id: t._id.toString()})));
    });

    taskChangeStream.on('error', (error) => {
      console.log('Task change stream error (real-time updates disabled):', error.message);
    });
  } catch (error) {
    console.log('Change streams not supported (real-time updates disabled). Consider using MongoDB Atlas or replica set configuration.');
  }
};

app.prepare().then(async () => {
  try {
    await connectToDb();
  } catch (e) {
    console.error('Failed to connect to the database', e);
    process.exit(1);
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  watchForChanges(io);

  io.on('connection', async (socket: Socket) => {
    console.log('A user connected:', socket.id);
    
    // Stream messages from MongoDB
    const messages = await chatMessagesCollection.find({}).sort({ timestamp: 1 }).toArray();
    const groupedMessages = messages.reduce((acc: any, msg: any) => {
        const key = msg.channelId;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push({ ...msg, id: msg._id.toString()});
        return acc;
    }, {});
    socket.emit('initial-messages', groupedMessages);
    
    const tasks = await tasksCollection.find({}).toArray();
    socket.emit('tasks-updated', tasks.map(t => ({...t, id: t._id.toString()})));

    socket.on('send-message', async (msg) => {
        try {
          await chatMessagesCollection.insertOne({
            ...msg,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error('Error adding document: ', error);
        }
    });

    socket.on('add-task', async (taskData) => {
        try {
            await tasksCollection.insertOne({ ...taskData, updates: [], pendingUpdate: null });
        } catch(e) {
            console.error("Error adding task", e);
        }
    });

    socket.on('update-task', async ({taskId, updates}) => {
        try {
             await tasksCollection.updateOne({ _id: new ObjectId(taskId) }, { $set: updates });
        } catch(e) {
            console.error("Error updating task", e);
        }
    });

    socket.on('add-update-to-task', async ({ taskId, update } : {taskId: string, update: any}) => {
        try {
            await tasksCollection.updateOne({_id: new ObjectId(taskId)}, {$push: {updates: update}});
        } catch(e) {
            console.error("Error adding update to task", e);
        }
    });


    socket.on('start-meeting', (data) => {
        io.emit('meeting-started', data);
    });
    
    socket.on('user-joined-meeting', (data) => {
        socket.broadcast.emit('user-joined', data);
    });
    
    socket.on('user-left-meeting', (data) => {
        socket.broadcast.emit('user-left', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
  });

  const port = parseInt(process.argv[2]?.split('=')[1] || process.env.PORT || '3000', 10);
  if (isNaN(port)) {
    console.error('Invalid port number provided.');
    process.exit(1);
  }
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
