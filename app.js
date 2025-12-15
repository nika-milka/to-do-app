const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Добавляем CORS

const app = express();

// Middleware
app.use(cors()); // Разрешаем кросс-доменные запросы
app.use(express.json());

// Конфигурация MongoDB подключения
const MONGODB_HOST = process.env.MONGODB_HOST || 'localhost';
const MONGODB_PORT = process.env.MONGODB_PORT || '27017';
const MONGODB_DB = process.env.MONGODB_DB || 'todo';
const MONGODB_URI = process.env.MONGODB_URI || `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DB}`;

console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);

// Подключение к MongoDB с обработкой ошибок
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Таймаут для выбора сервера
  socketTimeoutMS: 45000, // Таймаут сокета
})
.then(() => {
  console.log('✅ Successfully connected to MongoDB');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('Trying to continue without MongoDB...');
});

// Модель Todo
const todoSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  done: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware для обновления updatedAt
todoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

todoSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const Todo = mongoose.model('Todo', todoSchema);

// Маршруты

// Проверка здоровья
app.get('/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    timestamp: new Date(),
    mongoDB: mongoStatus,
    service: 'todo-api',
  });
});

// Получить все задачи
app.get('/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// Создать новую задачу
app.post('/todos', async (req, res) => {
  try {
    const { text, done = false } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const todo = new Todo({
      text: text.trim(),
      done,
    });
    
    await todo.save();
    
    res.status(201).json({
      id: todo._id,
      text: todo.text,
      done: todo.done,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    });
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// Получить задачу по ID
app.get('/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.json({
      id: todo._id,
      text: todo.text,
      done: todo.done,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching todo:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid todo ID format' });
    }
    
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// Обновить задачу
app.put('/todos/:id', async (req, res) => {
  try {
    const { text, done } = req.body;
    const updateData = {};
    
    if (text !== undefined) {
      updateData.text = text.trim();
    }
    
    if (done !== undefined) {
      updateData.done = done;
    }
    
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.json({
      id: todo._id,
      text: todo.text,
      done: todo.done,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid todo ID format' });
    }
    
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// Удалить задачу
app.delete('/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting todo:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid todo ID format' });
    }
    
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 MongoDB URI: ${MONGODB_URI}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 API: http://localhost:${PORT}/todos`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});