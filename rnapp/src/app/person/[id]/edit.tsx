import { useLocalSearchParams } from 'expo-router';
import { useRef, type ElementRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { PersonForm } from '@/components/person-form';
import { useContact, useUpdateContact } from '@/hooks/contacts';
import { colors, fonts, pagePadding } from '@/theme';

/**
 * 编辑联系人（T09 / T10）：预填当前信息，保存时更新联系人并重建特殊日期。
 */
export default function EditPersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useContact(id ?? '');
  const update = useUpdateContact(id ?? '');
  const scrollRef = useRef<ElementRef<typeof ScrollView>>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton />
          <Text style={styles.title}>编辑联系人</Text>
          <View style={styles.hint}>
            <Text style={styles.hintK}>✦</Text>
            <Text style={styles.hintText}>改后保存，提醒会按新日期重新安排。</Text>
          </View>

          {isLoading ? null : (
            <PersonForm
              initial={{ contact: data?.contact ?? null, dates: data?.dates ?? [] }}
              submitting={update.isPending}
              onFocusFeatures={() => scrollRef.current?.scrollToEnd({ animated: true })}
              onSubmit={(values) =>
                update.mutate(values, {
                  onError: (e) => Alert.alert('保存失败', e.message),
                })
              }
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: pagePadding,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 30,
  },
  title: {
    fontFamily: fonts.kai,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.ink,
    marginTop: 8,
  },
  hint: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 12,
  },
  hintK: {
    color: colors.moss,
    fontSize: 14,
  },
  hintText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.inkSoft,
  },
});
