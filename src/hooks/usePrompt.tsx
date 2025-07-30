import { useState, useCallback } from 'react';
import PromptDialog from '../components/PromptDialog';

interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
}

interface PromptState {
  isOpen: boolean;
  title: string;
  message: string;
  defaultValue: string;
  placeholder: string;
  resolve: ((value: string | null) => void) | null;
}

export const usePrompt = () => {
  const [promptState, setPromptState] = useState<PromptState>({
    isOpen: false,
    title: '',
    message: '',
    defaultValue: '',
    placeholder: '',
    resolve: null
  });

  const showPrompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        title: options.title || '输入',
        message: options.message,
        defaultValue: options.defaultValue || '',
        placeholder: options.placeholder || '',
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback((value: string | null) => {
    if (promptState.resolve) {
      promptState.resolve(value);
    }
    setPromptState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [promptState.resolve]);

  const handleCancel = useCallback(() => {
    if (promptState.resolve) {
      promptState.resolve(null);
    }
    setPromptState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [promptState.resolve]);

  const PromptComponent = useCallback(() => (
    <PromptDialog
      isOpen={promptState.isOpen}
      title={promptState.title}
      message={promptState.message}
      defaultValue={promptState.defaultValue}
      placeholder={promptState.placeholder}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [promptState, handleConfirm, handleCancel]);

  return {
    showPrompt,
    PromptComponent
  };
};

export default usePrompt;