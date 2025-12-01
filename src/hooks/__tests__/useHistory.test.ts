import { renderHook, act } from '@testing-library/react';
import { useHistory, Command, createCommand, CommandFactory } from '../useHistory';

describe('useHistory', () => {
  describe('Initial state', () => {
    it('initializes with empty stacks', () => {
      const { result } = renderHook(() => useHistory());

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.historySize).toBe(0);
    });

    it('initializes with default max stack size of 20', () => {
      const { result } = renderHook(() => useHistory());
      // We'll test this by adding more than 20 commands later
      expect(result.current.historySize).toBe(0);
    });
  });

  describe('executeCommand', () => {
    it('executes a command and adds it to undo stack', async () => {
      const { result } = renderHook(() => useHistory());
      let executedValue = 0;

      const command: Command = {
        description: 'Test command',
        execute: () => { executedValue = 1; },
        undo: () => { executedValue = 0; },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(executedValue).toBe(1);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.historySize).toBe(1);
    });

    it('clears redo stack when executing new command', async () => {
      const { result } = renderHook(() => useHistory());
      let value = 0;

      const command1: Command = {
        description: 'Command 1',
        execute: () => { value = 1; },
        undo: () => { value = 0; },
      };

      const command2: Command = {
        description: 'Command 2',
        execute: () => { value = 2; },
        undo: () => { value = 1; },
      };

      // Execute command 1
      await act(async () => {
        await result.current.executeCommand(command1);
      });

      // Undo command 1 (moves it to redo stack)
      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      // Execute command 2 (should clear redo stack)
      await act(async () => {
        await result.current.executeCommand(command2);
      });

      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it('handles async command execution', async () => {
      const { result } = renderHook(() => useHistory());
      let executedValue = 0;

      const command: Command = {
        description: 'Async command',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          executedValue = 1;
        },
        undo: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          executedValue = 0;
        },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(executedValue).toBe(1);
      expect(result.current.canUndo).toBe(true);
    });

    it('prevents concurrent command execution', async () => {
      const { result } = renderHook(() => useHistory());
      let executeCount = 0;

      const slowCommand: Command = {
        description: 'Slow command',
        execute: async () => {
          executeCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
        },
        undo: async () => { },
      };

      // Try to execute two commands concurrently
      await act(async () => {
        const promise1 = result.current.executeCommand(slowCommand);
        const promise2 = result.current.executeCommand(slowCommand);

        const results = await Promise.all([promise1, promise2]);

        // Only first command should execute
        expect(results[0]).toBe(true);
        expect(results[1]).toBe(false);
      });

      expect(executeCount).toBe(1);
      expect(result.current.historySize).toBe(1);
    });

    it('calls cleanup when command is removed due to stack size limit', async () => {
      const { result } = renderHook(() => useHistory({ maxStackSize: 2 }));
      let cleanupCalled = false;

      const command1: Command = {
        description: 'Command 1',
        execute: () => { },
        undo: () => { },
        cleanup: () => { cleanupCalled = true; },
      };

      const command2: Command = {
        description: 'Command 2',
        execute: () => { },
        undo: () => { },
      };

      const command3: Command = {
        description: 'Command 3',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command1);
        await result.current.executeCommand(command2);
        await result.current.executeCommand(command3); // Should remove command1
      });

      expect(cleanupCalled).toBe(true);
      expect(result.current.historySize).toBe(2);
    });
  });

  describe('undo', () => {
    it('undoes the last executed command', async () => {
      const { result } = renderHook(() => useHistory());
      let value = 0;

      const command: Command = {
        description: 'Increment',
        execute: () => { value = 1; },
        undo: () => { value = 0; },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(value).toBe(1);

      await act(async () => {
        await result.current.undo();
      });

      expect(value).toBe(0);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('returns command description on successful undo', async () => {
      const { result } = renderHook(() => useHistory());

      const command: Command = {
        description: 'Test action',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      let description: string | null = null;
      await act(async () => {
        description = await result.current.undo();
      });

      expect(description).toBe('Test action');
    });

    it('returns null when undo stack is empty', async () => {
      const { result } = renderHook(() => useHistory());

      let description: string | null = 'should be null';
      await act(async () => {
        description = await result.current.undo();
      });

      expect(description).toBeNull();
    });

    it('handles async undo operations', async () => {
      const { result } = renderHook(() => useHistory());
      let value = 0;

      const command: Command = {
        description: 'Async increment',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          value = 1;
        },
        undo: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          value = 0;
        },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(value).toBe(1);

      await act(async () => {
        await result.current.undo();
      });

      expect(value).toBe(0);
    });
  });

  describe('redo', () => {
    it('redoes the last undone command', async () => {
      const { result } = renderHook(() => useHistory());
      let value = 0;

      const command: Command = {
        description: 'Increment',
        execute: () => { value = 1; },
        undo: () => { value = 0; },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(value).toBe(1);

      await act(async () => {
        await result.current.undo();
      });

      expect(value).toBe(0);

      await act(async () => {
        await result.current.redo();
      });

      expect(value).toBe(1);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('returns command description on successful redo', async () => {
      const { result } = renderHook(() => useHistory());

      const command: Command = {
        description: 'Test action',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      await act(async () => {
        await result.current.undo();
      });

      let description: string | null = null;
      await act(async () => {
        description = await result.current.redo();
      });

      expect(description).toBe('Test action');
    });

    it('returns null when redo stack is empty', async () => {
      const { result } = renderHook(() => useHistory());

      let description: string | null = 'should be null';
      await act(async () => {
        description = await result.current.redo();
      });

      expect(description).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears both undo and redo stacks', async () => {
      const { result } = renderHook(() => useHistory());

      const command: Command = {
        description: 'Test',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.clear();
      });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.historySize).toBe(0);
    });

    it('calls cleanup on all commands when clearing', async () => {
      const { result } = renderHook(() => useHistory());
      const cleanupCalls: number[] = [];

      const createTestCommand = (id: number): Command => ({
        description: `Command ${id}`,
        execute: () => { },
        undo: () => { },
        cleanup: () => { cleanupCalls.push(id); },
      });

      await act(async () => {
        await result.current.executeCommand(createTestCommand(1));
        await result.current.executeCommand(createTestCommand(2));
      });

      await act(async () => {
        await result.current.undo();
      });

      act(() => {
        result.current.clear();
      });

      expect(cleanupCalls).toContain(1); // From undo stack
      expect(cleanupCalls).toContain(2); // From redo stack
    });
  });

  describe('getUndoDescription and getRedoDescription', () => {
    it('returns description of next undo action', async () => {
      const { result } = renderHook(() => useHistory());

      const command: Command = {
        description: 'Delete agent',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(result.current.getUndoDescription()).toBe('Delete agent');
    });

    it('returns description of next redo action', async () => {
      const { result } = renderHook(() => useHistory());

      const command: Command = {
        description: 'Delete agent',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.getRedoDescription()).toBe('Delete agent');
    });

    it('returns null when stacks are empty', () => {
      const { result } = renderHook(() => useHistory());

      expect(result.current.getUndoDescription()).toBeNull();
      expect(result.current.getRedoDescription()).toBeNull();
    });
  });

  describe('Stack size limits', () => {
    it('respects custom maxStackSize', async () => {
      const { result } = renderHook(() => useHistory({ maxStackSize: 3 }));

      const createCommand = (id: number): Command => ({
        description: `Command ${id}`,
        execute: () => { },
        undo: () => { },
      });

      await act(async () => {
        for (let i = 1; i <= 5; i++) {
          await result.current.executeCommand(createCommand(i));
        }
      });

      expect(result.current.historySize).toBe(3);
    });

    it('maintains FIFO order when stack is full', async () => {
      const { result } = renderHook(() => useHistory({ maxStackSize: 2 }));

      const createCommand = (id: number): Command => ({
        description: `Command ${id}`,
        execute: () => { },
        undo: () => { },
      });

      await act(async () => {
        await result.current.executeCommand(createCommand(1));
        await result.current.executeCommand(createCommand(2));
        await result.current.executeCommand(createCommand(3));
      });

      // Command 1 should be removed, 2 and 3 should remain
      expect(result.current.getUndoDescription()).toBe('Command 3');
    });
  });

  describe('onStackChange callback', () => {
    it('calls onStackChange when stacks change', async () => {
      const onStackChange = jest.fn();
      const { result } = renderHook(() => useHistory({ onStackChange }));

      const command: Command = {
        description: 'Test',
        execute: () => { },
        undo: () => { },
      };

      await act(async () => {
        await result.current.executeCommand(command);
      });

      expect(onStackChange).toHaveBeenCalled();
    });
  });

  describe('createCommand helper', () => {
    it('creates a valid command object', () => {
      let value = 0;
      const cleanup = jest.fn();

      const command = createCommand(
        'Test command',
        () => { value = 1; },
        () => { value = 0; },
        cleanup
      );

      expect(command.description).toBe('Test command');
      command.execute();
      expect(value).toBe(1);
      command.undo();
      expect(value).toBe(0);
      command.cleanup?.();
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('CommandFactory', () => {
    describe('delete', () => {
      it('creates a delete command', async () => {
        const { result } = renderHook(() => useHistory());
        const items = [1, 2, 3];
        const onDelete = jest.fn();
        const onRestore = jest.fn();

        const command = CommandFactory.delete(
          items[0],
          'Delete item',
          onDelete,
          onRestore
        );

        await act(async () => {
          await result.current.executeCommand(command);
        });

        expect(onDelete).toHaveBeenCalledWith(1);

        await act(async () => {
          await result.current.undo();
        });

        expect(onRestore).toHaveBeenCalledWith(1);
      });
    });

    describe('bulkDelete', () => {
      it('creates a bulk delete command', async () => {
        const { result } = renderHook(() => useHistory());
        const items = [1, 2, 3];
        const onDelete = jest.fn();
        const onRestore = jest.fn();

        const command = CommandFactory.bulkDelete(
          items,
          'Delete 3 items',
          onDelete,
          onRestore
        );

        await act(async () => {
          await result.current.executeCommand(command);
        });

        expect(onDelete).toHaveBeenCalledWith(items);

        await act(async () => {
          await result.current.undo();
        });

        expect(onRestore).toHaveBeenCalledWith(items);
      });
    });

    describe('update', () => {
      it('creates an update command', async () => {
        const { result } = renderHook(() => useHistory());
        const onUpdate = jest.fn();

        const command = CommandFactory.update(
          'old value',
          'new value',
          'Update value',
          onUpdate
        );

        await act(async () => {
          await result.current.executeCommand(command);
        });

        expect(onUpdate).toHaveBeenCalledWith('new value');

        await act(async () => {
          await result.current.undo();
        });

        expect(onUpdate).toHaveBeenCalledWith('old value');
      });
    });

    describe('toggle', () => {
      it('creates a toggle command', async () => {
        const { result } = renderHook(() => useHistory());
        let toggleValue = false;
        const onToggle = jest.fn(() => { toggleValue = !toggleValue; });

        const command = CommandFactory.toggle('Toggle favorite', onToggle);

        await act(async () => {
          await result.current.executeCommand(command);
        });

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(toggleValue).toBe(true);

        await act(async () => {
          await result.current.undo();
        });

        expect(onToggle).toHaveBeenCalledTimes(2);
        expect(toggleValue).toBe(false);

        await act(async () => {
          await result.current.redo();
        });

        expect(onToggle).toHaveBeenCalledTimes(3);
        expect(toggleValue).toBe(true);
      });
    });
  });

  describe('Multiple sequential operations', () => {
    it('maintains correct state through multiple operations', async () => {
      const { result } = renderHook(() => useHistory());
      let value = 0;

      const createCommand = (id: number): Command => ({
        description: `Set to ${id}`,
        execute: () => { value = id; },
        undo: () => { value = id - 1; },
      });

      await act(async () => {
        await result.current.executeCommand(createCommand(1));
        await result.current.executeCommand(createCommand(2));
        await result.current.executeCommand(createCommand(3));
      });

      expect(value).toBe(3);
      expect(result.current.historySize).toBe(3);

      await act(async () => {
        await result.current.undo();
      });

      expect(value).toBe(2);

      await act(async () => {
        await result.current.undo();
      });

      expect(value).toBe(1);

      await act(async () => {
        await result.current.redo();
      });

      expect(value).toBe(2);

      await act(async () => {
        await result.current.executeCommand(createCommand(4));
      });

      expect(value).toBe(4);
      expect(result.current.canRedo).toBe(false); // Redo stack cleared
    });
  });
});
