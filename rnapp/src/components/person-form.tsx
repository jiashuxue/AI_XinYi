import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RELATIONS, Contact, ContactDate, DateInput } from '@/hooks/contacts';
import { lunarToSolar } from '@/lib/lunar';
import { colors, fonts, radius } from '@/theme';

type DateRowState = {
  key: string;
  date_type: 'birthday' | 'anniversary';
  calendar: 'solar' | 'lunar';
  month: string;
  day: string;
};

const EMPTY_ROW = (key: string): DateRowState => ({
  key,
  date_type: 'birthday',
  calendar: 'solar',
  month: '',
  day: '',
});

let rowKey = 0;
const nextKey = () => `r${++rowKey}`;

const TYPE_OPTIONS: { label: string; date_type: 'birthday' | 'anniversary'; calendar: 'solar' | 'lunar' }[] = [
  { label: '公历生日', date_type: 'birthday', calendar: 'solar' },
  { label: '农历生日', date_type: 'birthday', calendar: 'lunar' },
  { label: '纪念日', date_type: 'anniversary', calendar: 'solar' },
];

type Props = {
  initial?: { contact: Contact | null; dates: ContactDate[] };
  submitting: boolean;
  onSubmit: (values: { name: string; relation: string | null; features: string | null; dates: DateInput[] }) => void;
};

/**
 * 添加 / 编辑联系人共用表单（T09 / T10）：
 * 姓名（必填）、关系 chips（预设单选 + 自定义）、特殊日期多行（公历生日 / 农历生日 / 纪念日，
 * 生日全局互斥仅一条；农历生日展示当年对应公历）、特征描述。
 */
export function PersonForm({ initial, submitting, onSubmit }: Props) {
  const [name, setName] = useState(initial?.contact?.name ?? '');
  const [relation, setRelation] = useState<string | null>(initial?.contact?.relation ?? null);
  const [customRelation, setCustomRelation] = useState('');
  const [features, setFeatures] = useState(initial?.contact?.features ?? '');
  const [dateRows, setDateRows] = useState<DateRowState[]>(() =>
    (initial?.dates ?? []).map((d) => ({
      key: nextKey(),
      date_type: d.date_type,
      calendar: d.calendar,
      month: String(d.month),
      day: String(d.day),
    }))
  );

  // 关系是否为自定义（不在预设中）
  const isCustom = !!relation && !(RELATIONS as readonly string[]).includes(relation);
  const activeRelation = isCustom ? '自定义' : relation;

  // 是否已存在生日行（生日全局互斥：公历 / 农历二选一，仅一条）
  const hasBirthday = dateRows.some((r) => r.date_type === 'birthday');

  const addRow = () => {
    const type = hasBirthday ? 'anniversary' : 'birthday';
    const row: DateRowState = hasBirthday
      ? { key: nextKey(), date_type: 'anniversary', calendar: 'solar', month: '', day: '' }
      : EMPTY_ROW(nextKey());
    setDateRows((rows) => [...rows, row]);
  };

  const updateRow = (key: string, patch: Partial<DateRowState>) => {
    setDateRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setDateRows((rows) => rows.filter((r) => r.key !== key));
  };

  const finalRelation = isCustom ? customRelation.trim() || null : relation;

  function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('提示', '请填写姓名');
      return;
    }
    // 组装有效日期行（月日均填写），并做基本范围校验
    const dates: DateInput[] = [];
    for (const r of dateRows) {
      if (!r.month && !r.day) continue; // 整行未填 → 跳过
      const month = Number(r.month);
      const day = Number(r.day);
      const maxDay = r.calendar === 'lunar' ? 30 : 31;
      if (!month || !day || month < 1 || month > 12 || day < 1 || day > maxDay) {
        Alert.alert('提示', '请填写有效的日期（月 1-12，日 1-31）');
        return;
      }
      dates.push({ date_type: r.date_type, calendar: r.calendar, month, day });
    }
    onSubmit({
      name,
      relation: finalRelation,
      features: features.trim() || null,
      dates,
    });
  }

  return (
    <View style={styles.form}>
      {/* 姓名（必填） */}
      <View style={styles.field}>
        <Text style={styles.label}>
          姓名 <Text style={styles.need}>必填</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="比如：妈妈 / 林小满"
          placeholderTextColor={colors.inkSoft}
        />
      </View>

      {/* 关系（单选 + 自定义） */}
      <View style={styles.field}>
        <Text style={styles.label}>
          关系 <Text style={styles.need}>单选一位</Text>
        </Text>
        <View style={styles.chips}>
          {RELATIONS.map((rel) => (
            <Chip
              key={rel}
              label={rel}
              active={activeRelation === rel}
              onPress={() => {
                setRelation(rel);
                setCustomRelation('');
              }}
            />
          ))}
          <Chip
            label="自定义…"
            active={isCustom}
            onPress={() => setRelation('自定义')}
          />
        </View>
        {isCustom && (
          <TextInput
            style={[styles.input, styles.customInput]}
            value={customRelation}
            onChangeText={setCustomRelation}
            placeholder="输入自定义关系，如：客户"
            placeholderTextColor={colors.inkSoft}
          />
        )}
      </View>

      {/* 特殊日期（可多个 · 可缺省） */}
      <View style={styles.field}>
        <Text style={styles.label}>
          特殊日子 <Text style={styles.need}>可多个 · 可缺省</Text>
        </Text>

        {dateRows.map((row) => (
          <View key={row.key} style={styles.dateRow}>
            <View style={styles.dateRowHead}>
              <View style={styles.typeSwitch}>
                {TYPE_OPTIONS.map((opt) => {
                  // 已有生日行时，其他行禁用生日选项（互斥）
                  const disabled =
                    opt.date_type === 'birthday' && row.date_type !== 'birthday' && hasBirthday;
                  const active =
                    row.date_type === opt.date_type && row.calendar === opt.calendar;
                  return (
                    <Pressable
                      key={opt.label}
                      style={[styles.typeBtn, active && styles.typeBtnOn, disabled && styles.typeBtnDisabled]}
                      disabled={disabled}
                      onPress={() =>
                        updateRow(row.key, { date_type: opt.date_type, calendar: opt.calendar })
                      }
                    >
                      <Text style={[styles.typeBtnText, active && styles.typeBtnTextOn]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => removeRow(row.key)} hitSlop={8}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.dayFields}>
              <View style={styles.dayField}>
                <TextInput
                  style={styles.dayInput}
                  value={row.month}
                  onChangeText={(t) => updateRow(row.key, { month: t.replace(/[^0-9]/g, '') })}
                  placeholder="月"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.daySep}>月</Text>
              <View style={styles.dayField}>
                <TextInput
                  style={styles.dayInput}
                  value={row.day}
                  onChangeText={(t) => updateRow(row.key, { day: t.replace(/[^0-9]/g, '') })}
                  placeholder="日"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.daySep}>日</Text>
            </View>

            {/* 农历生日：展示当年对应公历日期（T10 / spec 8 验收） */}
            {row.calendar === 'lunar' && (
              <LunarNote month={Number(row.month)} day={Number(row.day)} />
            )}
          </View>
        ))}

        <Pressable style={styles.addDate} onPress={addRow}>
          <Text style={styles.addDateText}>＋ 再记一个日子</Text>
        </Pressable>
      </View>

      {/* 特征描述 */}
      <View style={styles.field}>
        <Text style={styles.label}>
          特征描述 <Text style={styles.need}>写得越细，心意越像他本人</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={features}
          onChangeText={setFeatures}
          placeholder="比如：爱养花，今年刚退休。"
          placeholderTextColor={colors.inkSoft}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <Pressable style={[styles.save, submitting && styles.saveDisabled]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.saveText}>{submitting ? '保存中…' : '保存'}</Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function LunarNote({ month, day }: { month: number; day: number }) {
  const solar = useMemo(() => {
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 30) return null;
    return lunarToSolar(month, day, new Date().getFullYear());
  }, [month, day]);

  return (
    <Text style={styles.lunarNote}>
      农历生日会按当年实际公历换算提醒，遇闰月以实际对应日为准。
      {solar && (
        <Text style={styles.lunarNoteStrong}>
           {'\n'}今年（{new Date().getFullYear()}）对应公历 {solar.month}月{solar.day}日
        </Text>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: 4,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginBottom: 8,
    letterSpacing: 1,
  },
  need: {
    color: colors.moss,
    fontSize: 11,
    marginLeft: 4,
  },
  input: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    fontSize: 15,
    color: colors.ink,
  },
  customInput: {
    marginTop: 8,
  },
  textarea: {
    minHeight: 76,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipOn: {
    borderColor: colors.moss,
    backgroundColor: colors.moss,
  },
  chipText: {
    fontSize: 13,
    color: colors.ink,
  },
  chipTextOn: {
    color: '#fff',
  },
  dateRow: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.card,
  },
  dateRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeSwitch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  typeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  typeBtnOn: {
    backgroundColor: colors.moss,
    borderColor: colors.moss,
  },
  typeBtnDisabled: {
    opacity: 0.35,
  },
  typeBtnText: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  typeBtnTextOn: {
    color: '#fff',
  },
  remove: {
    fontSize: 14,
    color: colors.inkSoft,
    padding: 4,
  },
  dayFields: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  dayField: {
    flex: 1,
    maxWidth: 88,
  },
  dayInput: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },
  daySep: {
    fontSize: 14,
    color: colors.inkSoft,
  },
  lunarNote: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.inkSoft,
  },
  lunarNoteStrong: {
    color: colors.moss,
  },
  addDate: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addDateText: {
    fontFamily: fonts.kai,
    fontSize: 13.5,
    letterSpacing: 1,
    color: colors.inkSoft,
  },
  save: {
    backgroundColor: colors.moss,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: colors.mossDeep,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.onMoss,
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 3,
  },
});
