import { Modal, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BottomSheetProps = ViewProps & {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Pinned below the scrollable body — the apply/cancel row. */
  footer?: React.ReactNode;
};

/**
 * A panel that slides up from the bottom edge, dimming the screen behind it.
 *
 * Hand-rolled on React Native's own `Modal` rather than pulling in
 * `@gorhom/bottom-sheet`: the two sheets this app needs (date filter,
 * category picker) are both "open, choose, confirm" — neither snaps to
 * multiple heights, and neither is dragged. That's the entire feature set
 * `Modal` already gives, and the library would add a dependency plus its own
 * `GestureHandlerRootView` requirement for behaviour nothing here uses.
 *
 * `Modal` also gets the things that are genuinely annoying to hand-roll
 * right for free: it renders above everything including the native tab bar,
 * it traps focus, and on Android it wires the hardware back button to
 * `onRequestClose`.
 */
export function BottomSheet({ visible, onClose, title, footer, children, style, ...rest }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} onRequestClose={onClose} transparent animationType="slide" statusBarTranslucent>
      {/* Tapping the dimmed area closes — the standard escape hatch, and the
          reason this is a Pressable rather than a plain View. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="סגירה" />

      <View style={[styles.sheet, { backgroundColor: theme.background }, style]} {...rest}>
        <SafeAreaView edges={['bottom']}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />

          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>

          <View style={styles.body}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

type SheetButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` is the confirming action; `secondary` the dismissing one. */
  variant: 'primary' | 'secondary';
  disabled?: boolean;
};

/**
 * One button in a sheet's footer row. Both sheets use the same pair, so the
 * confirm/cancel affordance can't drift between them.
 *
 * The primary variant fills with `theme.primary` and labels itself with
 * `theme.background` rather than a hardcoded white: on the light theme the
 * accent is a deep burnt orange (white label) and on dark it's a soft
 * apricot (near-black label), so a fixed label color would fail contrast in
 * one of the two. `background` is the token that inverts with the accent.
 */
export function SheetButton({ label, onPress, variant, disabled }: SheetButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: isPrimary ? theme.primary : theme.backgroundElement },
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}>
      <ThemedText type="smallBold" style={[styles.buttonLabel, isPrimary && { color: theme.background }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.three,
  },
  body: {
    gap: Spacing.three,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    textAlign: 'center',
  },
});
