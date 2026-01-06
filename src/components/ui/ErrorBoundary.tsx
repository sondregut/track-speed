import React, { Component, ErrorInfo, ReactNode, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, typography, borderRadius } from '../../constants/theme';

// Import theme context directly to avoid circular deps
import ThemeContext from '../../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Inner component that uses theme
function ErrorDisplay({
  error,
  onRetry
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const theme = useContext(ThemeContext);
  const colors = theme?.colors || {
    gray: { 50: '#f9fafb', 500: '#6b7280', 900: '#111827' },
    error: { 100: '#fee2e2', 500: '#ef4444' },
    primary: { 500: '#3b82f6' },
    white: '#ffffff',
    background: { secondary: '#f9fafb' },
    text: { primary: '#111827', secondary: '#6b7280' },
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <View style={styles.content}>
        <Text style={[styles.icon, { color: colors.error[500], backgroundColor: colors.error[100] }]}>!</Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: colors.text.secondary }]}>
          {error?.message || 'An unexpected error occurred'}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary[500] }]}
          onPress={onRetry}
        >
          <Text style={[styles.buttonText, { color: colors.white }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  icon: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold as '700',
    width: 80,
    height: 80,
    lineHeight: 80,
    textAlign: 'center',
    borderRadius: 40,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
});
