import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Calendar,
  Flag,
  MoreVertical,
  X,
  Edit2,
  ListTodo,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';

interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: any;
  createdAt: any;
}

export default function TaskManager() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('completed', 'asc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(taskList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/tasks`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !newTaskTitle.trim()) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        userId: user.uid,
        title: newTaskTitle.trim(),
        completed: false,
        priority: newTaskPriority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewTaskTitle('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks`);
    }
  };

  const toggleTask = async (task: Task) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        completed: !task.completed,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks/${task.id}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/tasks/${taskId}`);
    }
  };

  const updateTaskTitle = async (taskId: string) => {
    if (!user || !editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', taskId), {
        title: editingTitle.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks/${taskId}`);
    }
  };

  const priorityColors = {
    low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    high: 'text-red-400 bg-red-400/10 border-red-400/20'
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 rounded-xl border border-white/10">
        <AlertCircle size={32} className="text-slate-500 mb-2" />
        <p className="text-slate-400 text-sm">Please sign in to manage your tasks</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ListTodo size={16} className="text-aura-accent" />
          My Tasks
          <span className="bg-aura-accent/20 text-aura-accent text-[10px] px-2 py-0.5 rounded-full ml-1">
            {tasks.filter(t => !t.completed).length} pending
          </span>
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1.5 bg-aura-accent/10 hover:bg-aura-accent/20 text-aura-accent rounded-lg transition-colors border border-aura-accent/20"
        >
          {isAdding ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={addTask}
            className="mb-4 space-y-2 overflow-hidden"
          >
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-aura-accent transition-colors"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {(['low', 'medium', 'high'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewTaskPriority(p)}
                    className={`flex-1 text-[10px] py-1 rounded-md border transition-all uppercase font-bold tracking-wider ${
                      newTaskPriority === p 
                        ? priorityColors[p] 
                        : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="bg-aura-accent hover:bg-aura-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1 rounded-lg text-xs font-bold transition-all shadow-lg shadow-aura-accent/20"
              >
                Add
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 size={24} className="text-aura-accent animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center opacity-40">
            <Calendar size={32} className="mb-2" />
            <p className="text-xs">No tasks yet. Enjoy your day!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <motion.div
              layout
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: task.completed ? 0.7 : 1, 
                y: 0,
                x: task.completed ? [0, 4, 0] : 0,
                backgroundColor: task.completed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.05)'
              }}
              transition={{ 
                layout: { type: 'spring', stiffness: 300, damping: 30 },
                backgroundColor: { duration: 0.3 }
              }}
              className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                task.completed 
                  ? 'border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' 
                  : 'border-white/10 hover:border-aura-accent/30'
              }`}
            >
              <button
                onClick={() => toggleTask(task)}
                className={`relative flex items-center justify-center transition-colors ${
                  task.completed ? 'text-emerald-500' : 'text-slate-500 hover:text-aura-accent'
                }`}
              >
                <motion.div
                  initial={false}
                  animate={{ 
                    scale: task.completed ? [1, 1.4, 1] : 1,
                    rotate: task.completed ? [0, 15, 0] : 0,
                    color: task.completed ? '#10b981' : '#64748b'
                  }}
                  transition={{ duration: 0.3 }}
                  className="z-10"
                >
                  {task.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                </motion.div>
                
                {task.completed && (
                  <>
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 bg-emerald-500 rounded-full blur-md -z-10"
                    />
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                        animate={{ 
                          scale: 0, 
                          x: (i === 0 ? -12 : i === 1 ? 12 : i === 2 ? -8 : 8),
                          y: (i === 0 ? -12 : i === 1 ? -12 : i === 2 ? 8 : 8),
                          opacity: 0 
                        }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="absolute w-1 h-1 bg-emerald-400 rounded-full"
                      />
                    ))}
                  </>
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                {editingId === task.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => updateTaskTitle(task.id)}
                    onKeyDown={(e) => e.key === 'Enter' && updateTaskTitle(task.id)}
                    className="w-full bg-aura-accent/10 border border-aura-accent/30 rounded px-2 py-1 text-sm text-white focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="relative">
                      <p className={`text-sm tracking-tight transition-all truncate ${
                        task.completed ? 'text-slate-500' : 'text-slate-200'
                      }`}>
                        {task.title}
                      </p>
                      <AnimatePresence>
                        {task.completed && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            exit={{ width: 0 }}
                            className="absolute top-1/2 left-0 h-px bg-slate-500 -translate-y-1/2"
                          />
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md border uppercase font-black ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingId(task.id);
                    setEditingTitle(task.title);
                  }}
                  className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-aura-accent rounded-lg transition-all"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
