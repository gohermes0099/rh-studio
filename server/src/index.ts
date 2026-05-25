import express from 'express';
import cors from 'cors';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import settingsRouter from './routes/settings.js';
import toolsRouter from './routes/tools.js';
import tasksRouter from './routes/tasks.js';
import uploadRouter from './routes/upload.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/settings', settingsRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/download', uploadRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const db = getDb();
runMigrations(db);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
