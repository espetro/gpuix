/**
 * GPUIX Todo Example
 *
 * Validates the interactive pieces a small desktop app needs: keyboard-driven
 * text input, pointer events, conditional rendering, scrolling layout, and
 * repeated state updates. It also creates a process-wide tray item whose
 * title, tooltip, and menu reflect the todo state.
 *
 * Run: bun todo.tsx
 */

import React, { useEffect, useMemo, useState } from 'react'
import { render, useGpuix } from '@gpuix/react'

type Todo = {
  id: number
  title: string
  done: boolean
}

type Filter = 'all' | 'active' | 'completed'

const colors = {
  app: '#11111b',
  panel: '#1e1e2e',
  raised: '#313244',
  border: '#45475a',
  text: '#cdd6f4',
  muted: '#a6adc8',
  faint: '#7f849c',
  accent: '#a6e3a1',
  accentHover: '#94e2d5',
  danger: '#f38ba8',
  dangerHover: '#eba0ac',
  selected: '#89b4fa',
}

const initialTodos: Todo[] = [
  { id: 1, title: 'Install the tray beta tarball', done: true },
  { id: 2, title: 'Run this example on macOS', done: false },
  { id: 3, title: 'Check input, clicks, scrolling, and rendering', done: false },
]

function ActionButton({
  label,
  onClick,
  tone = 'neutral',
  testId,
  disabled = false,
}: {
  label: string
  onClick: () => void
  tone?: 'neutral' | 'primary' | 'danger'
  testId?: string
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const backgroundColor = disabled
    ? colors.raised
    : tone === 'primary'
      ? hovered
        ? colors.accentHover
        : colors.accent
      : tone === 'danger'
        ? hovered
          ? colors.dangerHover
          : colors.danger
        : hovered
          ? colors.border
          : colors.raised
  const color = tone === 'neutral' ? colors.text : colors.panel

  return (
    <div
      testId={testId}
      style={{
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 14,
        paddingRight: 14,
        borderRadius: 8,
        backgroundColor,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
      onClick={() => {
        if (!disabled) onClick()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ color, fontSize: 13, fontWeight: 'bold' }}>{label}</div>
    </div>
  )
}

function FilterButton({
  filter,
  active,
  count,
  onClick,
}: {
  filter: Filter
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <div
      testId={`filter-${filter}`}
      style={{
        paddingTop: 7,
        paddingBottom: 7,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.selected : colors.border,
        backgroundColor: active ? colors.raised : 'transparent',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <div style={{ color: active ? colors.text : colors.muted, fontSize: 12 }}>
        {filter} · {count}
      </div>
    </div>
  )
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      testId={`todo-${todo.id}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 8,
        backgroundColor: hovered ? colors.raised : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        testId={`todo-${todo.id}-toggle`}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: todo.done ? colors.accent : colors.faint,
          backgroundColor: todo.done ? colors.accent : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={onToggle}
      >
        <div style={{ color: colors.panel, fontSize: 13, fontWeight: 'bold' }}>{todo.done ? '✓' : ''}</div>
      </div>

      <div
        style={{
          flexGrow: 1,
          color: todo.done ? colors.faint : colors.text,
          fontSize: 14,
          opacity: todo.done ? 0.65 : 1,
        }}
      >
        {todo.title}
      </div>

      <div
        testId={`todo-${todo.id}-delete`}
        style={{
          color: colors.danger,
          fontSize: 12,
          cursor: 'pointer',
          padding: 4,
          opacity: hovered ? 1 : 0.35,
        }}
        onClick={onDelete}
      >
        delete
      </div>
    </div>
  )
}

function TodoApp() {
  const { renderer } = useGpuix()
  const [todos, setTodos] = useState(initialTodos)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [nextId, setNextId] = useState(4)
  const [trayCreated, setTrayCreated] = useState(false)
  const [lastTrayEvent, setLastTrayEvent] = useState('none')

  useEffect(() => {
    if (!renderer) return
    const created = renderer.createTray?.({ title: '✓', tooltip: 'GPUIX Todo Validation' }) ?? false
    setTrayCreated(created)
    if (!created) return

    renderer.onTrayEvent?.(event => {
      console.log('[todo tray event]', event)
      if (event.type === 'menuItem') {
        setLastTrayEvent(`menu:${event.id}`)
        if (event.id === 'open') {
          try {
            renderer.activateWindow?.()
          } catch (error) {
            console.error('[todo tray] activateWindow failed', error)
            setLastTrayEvent('menu:open activate-error')
          }
        }
        if (event.id.startsWith('complete-')) {
          const id = Number(event.id.slice('complete-'.length))
          setTodos(current => current.map(todo => (todo.id === id ? { ...todo, done: true } : todo)))
        }
        if (event.id === 'quit') renderer.quit?.()
      } else {
        setLastTrayEvent(event.type)
        renderer.activateWindow?.()
      }
    })

    return () => {
      renderer.removeTray?.()
    }
  }, [renderer])

  const activeTodos = useMemo(() => todos.filter(todo => !todo.done), [todos])
  const activeCount = activeTodos.length
  const completedCount = todos.length - activeCount
  const counts = useMemo(
    () => ({ all: todos.length, active: activeCount, completed: completedCount }),
    [todos.length, activeCount, completedCount],
  )

  const visibleTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.done
    if (filter === 'completed') return todo.done
    return true
  })

  useEffect(() => {
    if (!renderer || !trayCreated) return
    renderer.setTrayTitle?.(`✓ ${activeCount}`)
    renderer.setTrayTooltip?.(`${activeCount} active · ${completedCount} completed`)
    const visibleTaskItems = activeTodos.slice(0, 6).map(todo => ({
      id: `complete-${todo.id}`,
      label: `○ ${todo.title}`,
    }))
    renderer.setTrayMenu?.([
      { id: 'open', label: 'Open app' },
      { id: 'summary', label: `${activeCount} active · ${completedCount} completed`, enabled: false },
      ...(activeTodos.length
        ? [
            { id: 'tasks-heading', label: 'Active tasks — choose one to complete it', enabled: false },
            ...visibleTaskItems,
          ]
        : [{ id: 'no-tasks', label: 'No active tasks', enabled: false }]),
      ...(activeTodos.length > 6
        ? [{ id: 'more-tasks', label: `${activeTodos.length - 6} more active tasks`, enabled: false }]
        : []),
      { id: 'quit', label: 'Quit' },
    ])
  }, [renderer, trayCreated, activeCount, completedCount, activeTodos])

  const addTodo = () => {
    const title = draft.trim()
    if (!title) return
    setTodos(current => [{ id: nextId, title, done: false }, ...current])
    setNextId(id => id + 1)
    setDraft('')
  }

  const toggleTodo = (id: number) => {
    setTodos(current => current.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo)))
  }

  const deleteTodo = (id: number) => {
    setTodos(current => current.filter(todo => todo.id !== id))
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.app,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          width: 520,
          height: 560,
          padding: 22,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.panel,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Todo validation</div>
            <div style={{ color: colors.muted, fontSize: 12 }}>
              {activeCount} active · {completedCount} completed
            </div>
          </div>
          <ActionButton
            label="Clear completed"
            testId="clear-completed"
            tone="danger"
            disabled={completedCount === 0}
            onClick={() => setTodos(current => current.filter(todo => !todo.done))}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.raised,
          }}
        >
          <input
            testId="new-todo-input"
            value={draft}
            placeholder="Add a validation task"
            onChange={event => setDraft(event.value ?? '')}
            style={{
              flexGrow: 1,
              minWidth: 0,
              height: 32,
              fontSize: 14,
              color: colors.text,
              backgroundColor: 'transparent',
            }}
          />
          <ActionButton label="Add" testId="add-todo" tone="primary" disabled={!draft.trim()} onClick={addTodo} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          {(['all', 'active', 'completed'] as Filter[]).map(item => (
            <FilterButton
              key={item}
              filter={item}
              active={filter === item}
              count={counts[item]}
              onClick={() => setFilter(item)}
            />
          ))}
        </div>

        <div
          testId="todo-list"
          style={{
            flexGrow: 1,
            minHeight: 0,
            overflowY: 'scroll',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingRight: 4,
          }}
        >
          {visibleTodos.length ? (
            visibleTodos.map(todo => (
              <TodoRow key={todo.id} todo={todo} onToggle={() => toggleTodo(todo.id)} onDelete={() => deleteTodo(todo.id)} />
            ))
          ) : (
            <div
              testId="empty-state"
              style={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.faint,
                fontSize: 14,
              }}
            >
              No {filter === 'all' ? '' : filter} todos
            </div>
          )}
        </div>

        <div style={{ color: colors.faint, fontSize: 11 }}>
          Tray: {trayCreated ? `active · last event ${lastTrayEvent}` : 'unavailable'} · input, buttons, rows,
          scrolling, and state updates are also exercised.
        </div>
      </div>
    </div>
  )
}

render(<TodoApp />, {
  title: 'GPUIX Todo Validation',
  width: 760,
  height: 680,
  focus: process.env.GPUIX_BACKGROUND !== '1',
  quitMode: 'explicit',
})
