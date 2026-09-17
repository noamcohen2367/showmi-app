import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWatchlist } from '@/hooks/use-watchlist';

type SaveButtonProps = {
  showId: string;
  showName: string;
  size?: number;
  /** Set on a button sitting over artwork, where the theme's text color may vanish. */
  onImage?: boolean;
};

/**
 * Adds or removes a show from the watchlist.
 *
 * This is the only way anything gets *into* the watchlist — the list screen,
 * its two sections and the swipe gesture all existed before this did, with
 * no route by which a show could reach them.
 *
 * Saving always lands a show in "רוצה לראות" (`toggleSaved`), never directly
 * in "ראיתי": saving is a statement of intent, and the only way something
 * becomes seen is the deliberate swipe on the list itself.
 */
export function SaveButton({ showId, showName, size = 22, onImage = false }: SaveButtonProps) {
  const theme = useTheme();
  const { statusOf, toggleSaved } = useWatchlist();

  const saved = statusOf(showId) !== undefined;
  const tint = onImage ? theme.onImage : saved ? theme.primary : theme.textSecondary;

  return (
    <Pressable
      onPress={() => toggleSaved(showId)}
      accessibilityRole="button"
      // Names the show, so a screen reader on a list of these doesn't read
      // out a row of identical "save" buttons.
      accessibilityLabel={saved ? `הסרת ${showName} מרשימת הצפייה` : `הוספת ${showName} לרשימת הצפייה`}
      accessibilityState={{ selected: saved }}
      // Enlarges the touch target without enlarging the glyph: the icon is
      // well under the 44pt minimum on its own.
      hitSlop={Spacing.three}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={size} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
