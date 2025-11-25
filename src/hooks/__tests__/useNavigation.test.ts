import { renderHook, act } from '@testing-library/react';
import { useNavigation } from '../useNavigation';
import { AgentScope } from '../../types';

const baseAgent = {
  id: '1',
  name: 'Agent',
  scope: AgentScope.Global,
  path: '',
  frontmatter: { name: 'Agent', description: '' },
  body: '',
};

describe('useNavigation', () => {
  test('navigateToCreate sets create view and return destination', () => {
    const { result } = renderHook(() => useNavigation({ initialView: 'team' }));
    act(() => {
      result.current.navigateToCreate('team');
    });
    expect(result.current.currentView).toBe('create');
    expect(result.current.returnDestination).toBe('team');
    expect(result.current.selectedAgent?.name).toBe('');
  });

  test('navigateToDuplicate generates unique name', () => {
    const existing = [
      baseAgent,
      { ...baseAgent, id: '2', name: 'Agent-copy', frontmatter: { name: 'Agent-copy', description: '' } },
    ];
    const { result } = renderHook(() => useNavigation({ agents: existing }));
    act(() => {
      result.current.navigateToDuplicate(baseAgent, 'subagents');
    });
    expect(result.current.currentView).toBe('duplicate');
    expect(result.current.selectedAgent?.name).toBe('Agent-copy-2');
  });

  test('cancelEditing returns to previous destination', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => {
      result.current.navigateToEdit(baseAgent, 'team');
    });
    expect(result.current.currentView).toBe('edit');
    act(() => {
      result.current.cancelEditing();
    });
    expect(result.current.currentView).toBe('team');
    expect(result.current.selectedAgent).toBeNull();
  });
});
