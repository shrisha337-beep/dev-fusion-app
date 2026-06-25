import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import tw from 'twrnc';
import { Calendar, Plus, Trash2, Info, RefreshCw } from 'lucide-react-native';
import { Member, SplitType } from '../utils/debtSimplifier';
import { Group, RecurringExpenseRule } from '../utils/db';

interface RecurringExpensesProps {
  group: Group;
  onAddRule: (rule: Omit<RecurringExpenseRule, 'id' | 'lastTriggeredDate'>) => void;
  onDeleteRule: (ruleId: string) => void;
  onTriggerCheck: () => void;
}

const FREQUENCIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'weekly', label: 'Weekly' },
] as const;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RecurringExpenses({
  group,
  onAddRule,
  onDeleteRule,
  onTriggerCheck,
}: RecurringExpensesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<RecurringExpenseRule['category']>('rent');
  const [payerId, setPayerId] = useState(group.members[0]?.id || '');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState('1'); // Monday (1)

  const memberMap = new Map<string, Member>();
  group.members.forEach(m => memberMap.set(m.id, m));

  const handleSaveRule = () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description.');
      return;
    }
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    const ruleData: Omit<RecurringExpenseRule, 'id' | 'lastTriggeredDate'> = {
      description: description.trim(),
      amount: numAmount,
      payerId,
      category,
      splitType: 'equal', // Simplify recurring splitting to equal for rapid hackathon build
      splits: {}, // Equal splits don't need values
      frequency,
      dayOfMonth: frequency === 'monthly' ? parseInt(dayOfMonth) || 1 : undefined,
      dayOfWeek: frequency === 'weekly' ? parseInt(dayOfWeek) || 0 : undefined,
    };

    onAddRule(ruleData);
    setIsAdding(false);
    setDescription('');
    setAmount('');
    Alert.alert('Rule Added', `"${ruleData.description}" has been configured. It will auto-post based on the schedule.`);
  };

  return (
    <ScrollView contentContainerStyle={tw`p-5 bg-slate-50 min-h-full pb-16`}>
      {/* Header Toolbar */}
      <View style={tw`flex-row justify-between items-center mb-5`}>
        <Text style={tw`text-xl font-bold text-slate-800`}>Recurring Expenses</Text>
        <TouchableOpacity
          onPress={() => setIsAdding(!isAdding)}
          style={tw`bg-indigo-600 px-4 py-2.5 rounded-xl flex-row items-center`}
        >
          <Plus color="white" size={14} style={tw`mr-1`} />
          <Text style={tw`text-white text-xs font-bold`}>{isAdding ? 'View Rules' : 'Add Rule'}</Text>
        </TouchableOpacity>
      </View>

      {/* Info notice */}
      <View style={tw`bg-slate-100 border border-slate-200 p-4 rounded-2xl mb-5 flex-row items-start`}>
        <Info size={16} color="#475569" style={tw`mr-2 mt-0.5`} />
        <View style={tw`flex-1`}>
          <Text style={tw`text-xs text-slate-600 font-medium leading-relaxed`}>
            Recurring expenses auto-post a new entry to the ledger whenever their scheduled date passes.
          </Text>
          <TouchableOpacity
            onPress={() => {
              onTriggerCheck();
              Alert.alert('Sync Complete', 'Scheduler processed and logged any pending entries.');
            }}
            style={tw`flex-row items-center mt-2 bg-white self-start px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs`}
          >
            <RefreshCw size={11} color="#4f46e5" style={tw`mr-1.5`} />
            <Text style={tw`text-indigo-600 text-[10px] font-extrabold uppercase tracking-wider`}>Run Scheduler Check</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isAdding ? (
        /* Add Form */
        <View style={tw`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6`}>
          <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Monthly Rent, Netflix Share"
            placeholderTextColor="#94a3b8"
            style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4`}
          />

          <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4`}
          />

          <Text style={tw`text-sm font-bold text-slate-700 mb-2`}>Paid By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-4`}>
            {group.members.map(m => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setPayerId(m.id)}
                style={tw`px-3.5 py-2 rounded-xl border mr-2 ${payerId === m.id ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
              >
                <Text style={tw`font-semibold text-xs ${payerId === m.id ? 'text-white' : 'text-slate-600'}`}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Frequency Selector */}
          <Text style={tw`text-sm font-bold text-slate-700 mb-2`}>Frequency</Text>
          <View style={tw`flex-row bg-slate-100 p-0.5 rounded-xl mb-4`}>
            {FREQUENCIES.map(f => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFrequency(f.id)}
                style={tw`flex-1 py-2.5 rounded-lg items-center ${frequency === f.id ? 'bg-white shadow-xs' : ''}`}
              >
                <Text style={tw`text-xs font-bold ${frequency === f.id ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Schedule Trigger Details */}
          {frequency === 'monthly' ? (
            <View style={tw`mb-5`}>
              <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Day of Month (1 - 31)</Text>
              <TextInput
                value={dayOfMonth}
                onChangeText={setDayOfMonth}
                placeholder="1"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                maxLength={2}
                style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50`}
              />
              <Text style={tw`text-slate-400 text-[10px] mt-1`}>e.g. Enter 1 for the 1st of every month</Text>
            </View>
          ) : (
            <View style={tw`mb-5`}>
              <Text style={tw`text-sm font-bold text-slate-700 mb-2`}>Day of Week</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {WEEKDAYS.map((day, idx) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setDayOfWeek(idx.toString())}
                    style={tw`px-3 py-2 rounded-xl border mr-2 ${dayOfWeek === idx.toString() ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <Text style={tw`text-xs font-semibold ${dayOfWeek === idx.toString() ? 'text-white' : 'text-slate-600'}`}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSaveRule}
            style={tw`bg-indigo-600 py-3.5 rounded-xl items-center shadow-sm`}
          >
            <Text style={tw`text-white font-bold text-base`}>Save Recurring Rule</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Rules List */
        <View>
          {group.recurringExpenses.length === 0 ? (
            <View style={tw`bg-white border border-slate-100 p-8 rounded-2xl items-center shadow-xs`}>
              <Text style={tw`text-slate-400 font-semibold text-sm`}>No recurring expenses set up</Text>
              <Text style={tw`text-slate-300 text-xs mt-1`}>Tap "Add Rule" to configure automatically billed items.</Text>
            </View>
          ) : (
            group.recurringExpenses.map(rule => {
              const payerName = memberMap.get(rule.payerId)?.name || 'Unknown';
              return (
                <View
                  key={rule.id}
                  style={tw`bg-white p-4 rounded-2xl border border-slate-100 mb-3.5 shadow-sm flex-row justify-between items-center`}
                >
                  <View style={tw`flex-1 pr-3`}>
                    <Text style={tw`font-extrabold text-slate-800 text-base`}>{rule.description}</Text>
                    <Text style={tw`text-slate-500 text-xs mt-1`}>
                      ₹{rule.amount.toFixed(2)} paid by <Text style={tw`font-semibold`}>{payerName}</Text>
                    </Text>
                    
                    <View style={tw`flex-row items-center mt-2.5`}>
                      <Calendar size={12} color="#4f46e5" style={tw`mr-1`} />
                      <Text style={tw`text-indigo-600 text-[10px] font-bold uppercase tracking-wider`}>
                        {rule.frequency === 'monthly' ? `Every Month (Day ${rule.dayOfMonth})` : `Every Week (${WEEKDAYS[rule.dayOfWeek || 0]})`}
                      </Text>
                    </View>
                    {rule.lastTriggeredDate && (
                      <Text style={tw`text-slate-400 text-[9px] mt-1`}>
                        Last posted: {new Date(rule.lastTriggeredDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => onDeleteRule(rule.id)}
                    style={tw`w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100`}
                  >
                    <Trash2 size={14} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}
