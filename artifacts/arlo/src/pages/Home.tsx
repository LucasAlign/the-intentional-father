import { useState, useEffect, useRef } from 'react';
import styles from './Home.module.css';

interface Task {
  id: number;
  text: string;
  category: string;
  partial: boolean;
  done: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface JournalEntry {
  reflect: string;
  commit_text: string;
}

export default function Home() {
  const [verse, setVerse] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingVerse, setLoadingVerse] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingChat, setLoadingChat] = useState(true);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [sending, setSending] = useState(false);
  const [journal, setJournal] = useState<JournalEntry>({ reflect: '', commit_text: '' });
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/verse')
        .then(r => r.ok ? r.text() : '')
        .then(v => { if (v) setVerse(v); })
        .finally(() => setLoadingVerse(false)),
      fetch('/api/tasks')
        .then(r => r.ok ? r.json() : [])
        .then(t => setTasks(t))
        .finally(() => setLoadingTasks(false)),
      fetch('/api/chat-history')
        .then(r => r.ok ? r.json() : [])
        .then(msgs => setMessages(msgs))
        .finally(() => setLoadingChat(false)),
      fetch('/api/journal')
        .then(r => r.ok ? r.json() : null)
        .then(data => setJournal(data || { reflect: '', commit_text: '' }))
        .finally(() => setLoadingJournal(false)),
    ]).catch(err => console.error('Failed to load data:', err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input;
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages(prev => prev.slice(0, -1));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  async function saveJournal() {
    try {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journal),
      });
    } catch (error) {
      console.error('Failed to save journal:', error);
    }
  }

  async function completeTask(id: number) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true }),
      });
    } catch (err) {
      console.error('Failed to complete task:', err);
      fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(setTasks);
    }
  }

  async function togglePartial(id: number, current: boolean) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, partial: !current } : t));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partial: !current }),
      });
    } catch (err) {
      console.error('Failed to update task:', err);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, partial: current } : t));
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskText.trim() || addingTask) return;
    setAddingTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newTaskText.trim(), category: newTaskCategory.trim() }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks(prev => [task, ...prev].slice(0, 3));
        setNewTaskText('');
        setNewTaskCategory('');
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setAddingTask(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>ARLO</h1>
        <p className={styles.tagline}>FOCUSED · FAITHFUL · FREE</p>
      </header>

      <main className={styles.main}>
        {/* Verse Card */}
        <div className={`${styles.card} ${styles.verseCard}`}>
          <div className={styles.cardContent}>
            {loadingVerse ? (
              <div className={styles.skeletonVerse} />
            ) : (
              <p className={styles.verseText}>{verse}</p>
            )}
          </div>
        </div>

        {/* Marriage Intention Card */}
        <div className={`${styles.card} ${styles.marriageCard}`}>
          <h3 className={styles.cardTitle}>Her</h3>
          <p className={styles.subtitle}>Today's intention</p>
          {loadingJournal ? (
            <div className={styles.skeletonInput} />
          ) : (
            <input
              type="text"
              placeholder="What's your intention for your marriage today?"
              className={styles.input}
              value={journal.commit_text}
              onChange={(e) => setJournal((prev) => ({ ...prev, commit_text: e.target.value }))}
              onBlur={saveJournal}
            />
          )}
        </div>

        {/* Top 3 Priorities */}
        <div className={`${styles.card} ${styles.prioritiesCard}`}>
          <h3 className={styles.cardTitle}>Top 3</h3>
          <div className={styles.taskList}>
            {loadingTasks ? (
              <>
                <div className={styles.skeletonTask} />
                <div className={styles.skeletonTask} />
                <div className={styles.skeletonTask} />
              </>
            ) : tasks.length === 0 ? (
              <p className={styles.noData}>No open tasks</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className={styles.taskItem}>
                  <button
                    className={styles.completeBtn}
                    onClick={() => completeTask(task.id)}
                    title="Mark complete"
                  />
                  <div className={styles.taskText}>
                    <p>{task.text}</p>
                    {task.category && <span className={styles.category}>{task.category}</span>}
                  </div>
                  <button
                    className={`${styles.stuck} ${task.partial ? styles.stuckActive : ''}`}
                    onClick={() => togglePartial(task.id, task.partial)}
                    title={task.partial ? 'Unmark stuck' : 'Mark stuck at 80%'}
                  >
                    80%
                  </button>
                </div>
              ))
            )}
          </div>
          <form onSubmit={addTask} className={styles.addTaskForm}>
            <input
              type="text"
              placeholder="Add a task…"
              className={styles.addTaskInput}
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
            />
            <input
              type="text"
              placeholder="Category"
              className={styles.addTaskCategory}
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value)}
            />
            <button
              type="submit"
              className={styles.addTaskBtn}
              disabled={addingTask || !newTaskText.trim()}
            >
              +
            </button>
          </form>
        </div>

        {/* Daily Reflection */}
        <div className={`${styles.card} ${styles.reflectCard}`}>
          <h3 className={styles.cardTitle}>Reflect</h3>
          {loadingJournal ? (
            <div className={styles.skeletonTextarea} />
          ) : (
            <textarea
              placeholder="What did you learn today? What will you do differently?"
              className={styles.textarea}
              value={journal.reflect}
              onChange={(e) => setJournal((prev) => ({ ...prev, reflect: e.target.value }))}
              onBlur={saveJournal}
              rows={4}
            />
          )}
        </div>

        {/* Chat Section */}
        <div className={`${styles.card} ${styles.chatCard}`}>
          <h3 className={styles.cardTitle}>Message Arlo</h3>
          <div className={styles.chatMessages}>
            {loadingChat ? (
              <div className={styles.skeletonChat} />
            ) : messages.length === 0 ? (
              <p className={styles.noMessages}>No messages yet. Start talking to Arlo.</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
                >
                  <p>{msg.content}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className={styles.chatForm}>
            <input
              type="text"
              placeholder="What's on your mind?"
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={sending || !input.trim()}
            >
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>FAITH · FOCUS · FOLLOW THROUGH</p>
      </footer>
    </div>
  );
}
