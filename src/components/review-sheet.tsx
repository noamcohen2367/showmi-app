import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet, SheetButton } from './bottom-sheet';
import { StarRating } from './star-rating';
import { ThemedText } from './themed-text';

import {
  FEELING_TAGS,
  MAX_FEELING_TAGS,
  PRICE_VERDICTS,
  type PriceVerdict,
} from '@/constants/review-tags';
import { Spacing } from '@/constants/theme';
import { deleteReview, saveReview, type Review, type ReviewDraft } from '@/data/reviews';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * Writing or editing a review.
 *
 * A sheet rather than a screen, unlike the "show I saw abroad" form. The
 * keyboard argument that moved that one out of a sheet was about three text
 * fields; this has one, and everything above it is taps. What matters more
 * here is staying on the show — a review is *about* what is behind the
 * sheet, and pushing a screen would hide it.
 *
 * One review per person per show is the database's rule, so this is the edit
 * screen as well as the compose screen. When one already exists it opens
 * filled in, and gains a way to remove it.
 */
export function ReviewSheet({
  visible,
  onClose,
  showId,
  showName,
  existing,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  showId: string;
  showName: string;
  /** The signed-in user's own review, if they have already written one. */
  existing: Review | null;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(existing?.wouldReturn ?? null);
  const [price, setPrice] = useState<PriceVerdict | null>(existing?.priceVerdict ?? null);
  const [body, setBody] = useState(existing?.body ?? '');
  const [saving, setSaving] = useState(false);

  // Reset from `existing` each time the sheet opens, so editing one review,
  // dismissing, and opening another does not show the first one's answers.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) {
      setRating(existing?.rating ?? 0);
      setTags(existing?.tags ?? []);
      setWouldReturn(existing?.wouldReturn ?? null);
      setPrice(existing?.priceVerdict ?? null);
      setBody(existing?.body ?? '');
    }
  }

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : // Silently ignores a tap past the limit rather than disabling the
          // remaining tags, which would look broken. The counter above says
          // why nothing happened.
          current.length >= MAX_FEELING_TAGS
          ? current
          : [...current, tag],
    );
  }

  async function submit() {
    if (!user || rating === 0) return;
    setSaving(true);
    try {
      const draft: ReviewDraft = {
        rating,
        tags,
        ...(body.trim() ? { body } : {}),
        ...(wouldReturn === null ? {} : { wouldReturn }),
        ...(price === null ? {} : { priceVerdict: price }),
      };
      await saveReview(user.id, showId, profile?.fullName ?? profile?.username ?? null, draft);
      onSaved();
      onClose();
    } catch {
      Alert.alert('הביקורת לא נשמרה', 'בדקו את החיבור ונסו שוב.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('למחוק את הביקורת?', 'אי אפשר לשחזר אותה.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deleteReview(user.id, showId);
            onSaved();
            onClose();
          } catch {
            Alert.alert('לא הצלחנו למחוק', 'בדקו את החיבור ונסו שוב.');
          }
        },
      },
    ]);
  }

  const footer = (
    <>
      <SheetButton label="ביטול" variant="secondary" onPress={onClose} />
      <SheetButton
        label={saving ? 'שומר…' : existing ? 'עדכון' : 'פרסום'}
        variant="primary"
        disabled={rating === 0 || saving}
        onPress={submit}
      />
    </>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={showName} footer={footer}>
      {/* `handled` rather than `always`: a tap on Publish while the keyboard
          is open has to publish, not just dismiss the keyboard and make the
          user press twice. `interactive` lets the keyboard be dragged away
          with the content, which is the gesture people reach for first. */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <Section label="הדירוג שלך" required>
          <StarRating value={rating} onChange={setRating} size={30} />
        </Section>

        <Section
          label="איך זה הרגיש?"
          hint={`עד ${MAX_FEELING_TAGS} · נבחרו ${tags.length}`}>
          <View style={styles.tags}>
            {FEELING_TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
                      borderColor: selected ? theme.primary : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" themeColor={selected ? 'primary' : 'text'}>
                    {tag}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section label="המחיר" optional>
          <View style={styles.tags}>
            {PRICE_VERDICTS.map((option) => (
              <Choice
                key={option.value}
                label={option.label}
                selected={price === option.value}
                // Pressing the selected one clears it: these are optional,
                // and without this there is no way back to "no opinion"
                // once a value has been tapped by accident.
                onPress={() => setPrice(price === option.value ? null : option.value)}
              />
            ))}
          </View>
        </Section>

        <Section label="היית חוזר?" optional>
          <View style={styles.tags}>
            <Choice
              label="כן"
              selected={wouldReturn === true}
              onPress={() => setWouldReturn(wouldReturn === true ? null : true)}
            />
            <Choice
              label="לא"
              selected={wouldReturn === false}
              onPress={() => setWouldReturn(wouldReturn === false ? null : false)}
            />
          </View>
        </Section>

        <Section label="מה רצית להגיד?" optional>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="כמה מילים על ההצגה"
            placeholderTextColor={theme.textSecondary}
            style={[styles.body, { color: theme.text, borderColor: theme.backgroundSelected }]}
            accessibilityLabel="טקסט הביקורת"
            multiline
            textAlignVertical="top"
          />
        </Section>

        {existing ? (
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="primary">
              מחיקת הביקורת
            </ThemedText>
          </Pressable>
        ) : null}

        {saving ? <ActivityIndicator color={theme.primary} /> : null}

        {/* Said before publishing, not after. Somebody about to write
            something public should know it is public while they write it. */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
          הביקורת תוצג לכל מי שצופה בהצגה הזו, לצד השם שלך.
        </ThemedText>
      </ScrollView>
    </BottomSheet>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
          borderColor: selected ? theme.primary : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" themeColor={selected ? 'primary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Section({
  label,
  hint,
  required = false,
  optional = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">
        {label}
        {optional ? (
          <ThemedText type="small" themeColor="textSecondary">
            {'  '}(רשות)
          </ThemedText>
        ) : null}
        {required ? (
          <ThemedText type="small" themeColor="primary">
            {'  '}*
          </ThemedText>
        ) : null}
      </ThemedText>
      {children}
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  body: {
    fontSize: 16,
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    includeFontPadding: false,
  },
  delete: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
  notice: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
