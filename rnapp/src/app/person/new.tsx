import { useRef, type ElementRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { PersonForm } from '@/components/person-form';
import { useCreateContact } from '@/hooks/contacts';
import { colors, fonts, pagePadding } from '@/theme';

/**
 * 添加联系人（T09 / T10 / T12）：
 * 姓名必填、关系 chips + 自定义、特殊日期多行录入、特征描述；保存含 10 位上限校验。
 */
export default function NewPersonScreen() {
  const create = useCreateContact();
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
          <Text style={styles.title}>记一位在乎的人</Text>
          <View style={styles.hint}>
            <Text style={styles.hintK}>✦</Text>
            <Text style={styles.hintText}>姓名必填，其余都可以先空着、之后再补。</Text>
          </View>

          <PersonForm
            submitting={create.isPending}
            onFocusFeatures={() => scrollRef.current?.scrollToEnd({ animated: true })}
            onSubmit={(values) =>
              create.mutate(values, {
                onError: (e) => Alert.alert('保存失败', e.message), // 含 10 位上限等校验错误
              })
            }
          />
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
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.inkSoft,
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
