import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { colors, fonts, pagePadding, radius } from '@/theme';

type AuthMode = 'login' | 'signup' | 'forgot';

/** 重置密码落地页（公网静态托管，与 GitHub Pages 部署地址保持一致） */
const RESET_URL = 'https://jiashuxue.github.io/AI_XinYi/reset.html';

/**
 * 登录 / 注册 / 忘记密码（T05）：邮箱 + 密码，参照原型登录页视觉。
 * 登录成功后 onAuthStateChange 刷新会话，根布局 Auth 守卫自动切回主界面。
 * 忘记密码：发送 Supabase 恢复邮件，邮件内链接指向公网静态重置页（reset.html）。
 */
export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleMode = () => setMode((m) => (m === 'login' ? 'signup' : 'login'));

  async function handleSubmit() {
    if (!email.trim()) return Alert.alert('提示', '请填写邮箱');
    if (mode !== 'forgot' && !password) return Alert.alert('提示', '请填写密码');
    if (mode === 'signup' && password.length < 6) return Alert.alert('提示', '密码至少 6 位');

    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        // 发送恢复邮件，链接指向公网静态重置页；支持邮箱确认项目下同样可用
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: RESET_URL,
        });
        if (error) {
          Alert.alert('发送失败', error.message);
          return;
        }
        Alert.alert('已发送', '重置链接已发到你的邮箱，请查收后在网页中设置新密码。');
        setMode('login');
        return;
      }
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          Alert.alert('登录失败', error.message);
          return;
        }
        router.replace('/'); // 兜底跳首页（正常情况下守卫会自动切换）
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          Alert.alert('注册失败', error.message);
          return;
        }
        if (data.session) {
          router.replace('/');
        } else {
          // 项目开启邮箱确认时：提示查收邮件
          Alert.alert('注册成功', '请查收邮箱中的确认邮件，再回来登录。');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.center}>
          <View style={styles.mark}>
            <Text style={styles.markFace}>🪷</Text>
          </View>
          <Text style={styles.title}>{mode === 'forgot' ? '重置密码' : '心意管家'}</Text>
          <Text style={styles.slogan}>
            {mode === 'forgot'
              ? '填写你的邮箱，\n我们把重置链接发给你。'
              : '把日子交给它，\n把心意留给自己。'}
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>邮箱</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {mode !== 'forgot' && (
              <View style={styles.field}>
                <Text style={styles.label}>密码</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? '至少 6 位' : '输入密码'}
                  placeholderTextColor={colors.inkSoft}
                  secureTextEntry
                />
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting
                  ? '请稍候…'
                  : mode === 'login'
                    ? '登 录'
                    : mode === 'signup'
                      ? '注 册'
                      : '发送重置邮件'}
              </Text>
            </Pressable>

            {mode === 'forgot' ? (
              <View style={styles.switchLine}>
                <Pressable onPress={() => setMode('login')}>
                  <Text style={styles.switchBtn}>返回登录</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.switchLine}>
                <Text style={styles.switchText}>{mode === 'login' ? '还没有账号？' : '已有账号？'}</Text>
                <Pressable onPress={toggleMode}>
                  <Text style={styles.switchBtn}>{mode === 'login' ? '去注册' : '去登录'}</Text>
                </Pressable>
              </View>
            )}

            {mode === 'login' && (
              <View style={styles.switchLine}>
                <Pressable onPress={() => setMode('forgot')}>
                  <Text style={styles.forgotBtn}>忘记密码？</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={styles.privacyNote}>
            联系人信息只用于为你本人准备心意，App 不会对外共享。
          </Text>
        </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  markFace: {
    fontSize: 40,
  },
  title: {
    fontFamily: fonts.kai,
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: 3,
    color: colors.ink,
  },
  slogan: {
    marginTop: 10,
    fontFamily: fonts.kai,
    fontSize: 13.5,
    lineHeight: 24,
    color: colors.inkSoft,
    letterSpacing: 1,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginTop: 30,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginBottom: 6,
    letterSpacing: 1,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    fontSize: 15,
    color: colors.ink,
  },
  submit: {
    marginTop: 6,
    backgroundColor: colors.moss,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: colors.mossDeep,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitText: {
    color: colors.onMoss,
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 3,
  },
  switchLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  switchText: {
    fontSize: 13,
    color: colors.inkSoft,
  },
  switchBtn: {
    fontFamily: fonts.kai,
    fontSize: 14,
    color: colors.moss,
  },
  forgotBtn: {
    fontSize: 13,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  privacyNote: {
    width: '100%',
    marginTop: 26,
    fontSize: 11,
    lineHeight: 19,
    color: colors.inkSoft,
    letterSpacing: 0.5,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
    paddingTop: 14,
  },
});
