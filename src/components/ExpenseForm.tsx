import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import tw from 'twrnc';
import { Check, Info } from 'lucide-react-native';
import { Member, Expense, SplitType } from '../utils/debtSimplifier';

interface ExpenseFormProps {
  members: Member[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
  onCancel: () => void;
  initialExpense?: Expense | null; // For editing existing
}

const CATEGORIES = [
  { id: 'food', label: 'Food', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'travel', label: 'Travel', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { id: 'rent', label: 'Rent', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'utilities', label: 'Utilities', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'entertainment', label: 'Entertainment', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'other', label: 'Other', color: 'bg-slate-100 text-slate-700 border-slate-200' },
] as const;

export default function ExpenseForm({ members, onAddExpense, onCancel, initialExpense }: ExpenseFormProps) {
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [amount, setAmount] = useState(initialExpense?.amount ? initialExpense.amount.toString() : '');
  const [category, setCategory] = useState<Expense['category']>(initialExpense?.category || 'food');
  const [payerId, setPayerId] = useState(initialExpense?.payerId || members[0]?.id || '');
  const [splitType, setSplitType] = useState<SplitType>(initialExpense?.splitType || 'equal');

  // For Equal Split: keep track of who is INCLUDED (by default, everyone)
  const [includedMembers, setIncludedMembers] = useState<{ [id: string]: boolean }>(() => {
    const state: { [id: string]: boolean } = {};
    members.forEach(m => {
      // If editing, check excluded list
      if (initialExpense) {
        state[m.id] = !initialExpense.excludedMemberIds?.includes(m.id);
      } else {
        state[m.id] = true;
      }
    });
    return state;
  });

  // For unequal splits: stores exact numbers (percentages, exact ₹ values, or shares)
  const [splitValues, setSplitValues] = useState<{ [id: string]: string }>(() => {
    const state: { [id: string]: string } = {};
    members.forEach(m => {
      if (initialExpense && initialExpense.splitType === splitType) {
        state[m.id] = (initialExpense.splits[m.id] || 0).toString();
      } else {
        state[m.id] = splitType === 'shares' ? '1' : '';
      }
    });
    return state;
  });

  // Re-initialize splitValues when splitType changes
  useEffect(() => {
    if (initialExpense && initialExpense.splitType === splitType) return;
    
    const state: { [id: string]: string } = {};
    members.forEach(m => {
      if (splitType === 'shares') {
        state[m.id] = '1';
      } else {
        state[m.id] = '';
      }
    });
    setSplitValues(state);
  }, [splitType]);

  const toggleEqualMember = (id: string) => {
    setIncludedMembers(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSplitValueChange = (id: string, text: string) => {
    // Only allow numeric input
    const cleanText = text.replace(/[^0-9.]/g, '');
    setSplitValues(prev => ({
      ...prev,
      [id]: cleanText
    }));
  };

  // Helper calculations for validation
  const numAmount = parseFloat(amount) || 0;
  
  const getValidationStats = () => {
    if (splitType === 'equal') {
      const activeCount = Object.values(includedMembers).filter(Boolean).length;
      return { isValid: activeCount > 0, sum: numAmount, diff: 0, text: `${activeCount} participants` };
    }
    
    let sum = 0;
    Object.values(splitValues).forEach(val => {
      sum += parseFloat(val) || 0;
    });

    if (splitType === 'percentage') {
      const diff = 100 - sum;
      const isValid = Math.abs(diff) < 0.01 && numAmount > 0;
      return { isValid, sum, diff, text: `Current sum: ${sum.toFixed(1)}% / 100% (Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)` };
    }

    if (splitType === 'exact') {
      const diff = numAmount - sum;
      const isValid = Math.abs(diff) < 0.01 && numAmount > 0;
      return { isValid, sum, diff, text: `Current sum: ₹${sum.toFixed(2)} / ₹${numAmount.toFixed(2)} (Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}₹)` };
    }

    if (splitType === 'shares') {
      const isValid = sum > 0 && numAmount > 0;
      return { isValid, sum, diff: 0, text: `Total shares: ${sum}` };
    }

    return { isValid: false, sum: 0, diff: 0, text: '' };
  };

  const stats = getValidationStats();

  const handleSave = () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description.');
      return;
    }
    if (numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!stats.isValid) {
      if (splitType === 'percentage') {
        Alert.alert('Error', 'Percentages must add up to exactly 100%.');
      } else if (splitType === 'exact') {
        Alert.alert('Error', 'Exact split amounts must add up to the total expense amount.');
      } else if (splitType === 'equal') {
        Alert.alert('Error', 'Please select at least one participant.');
      } else if (splitType === 'shares') {
        Alert.alert('Error', 'Total shares must be greater than 0.');
      }
      return;
    }

    // Format splits and excluded lists
    const finalSplits: { [id: string]: number } = {};
    const excludedMemberIds: string[] = [];

    if (splitType === 'equal') {
      members.forEach(m => {
        if (!includedMembers[m.id]) {
          excludedMemberIds.push(m.id);
        }
      });
    } else {
      members.forEach(m => {
        finalSplits[m.id] = parseFloat(splitValues[m.id]) || 0;
      });
    }

    onAddExpense({
      description: description.trim(),
      amount: numAmount,
      payerId,
      category,
      splitType,
      splits: finalSplits,
      excludedMemberIds: excludedMemberIds.length > 0 ? excludedMemberIds : undefined,
    });
  };

  return (
    <ScrollView contentContainerStyle={tw`p-5 bg-slate-50 min-h-full pb-10`}>
      <View style={tw`flex-row justify-between items-center mb-6`}>
        <Text style={tw`text-2xl font-bold text-slate-800`}>
          {initialExpense ? 'Edit Expense' : 'Log Expense'}
        </Text>
        <TouchableOpacity onPress={onCancel} style={tw`bg-slate-200 px-4 py-2 rounded-xl`}>
          <Text style={tw`text-slate-700 font-semibold`}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Main Inputs */}
      <View style={tw`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-5`}>
        <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Dinner, Rent share, Cab"
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
          style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4 font-bold text-lg`}
        />

        <Text style={tw`text-sm font-bold text-slate-700 mb-2`}>Paid By</Text>
        <View style={tw`flex-row flex-wrap mb-4`}>
          {members.map(m => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setPayerId(m.id)}
              style={tw`px-4 py-2.5 rounded-xl border mr-2 mb-2 ${payerId === m.id ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
            >
              <Text style={tw`font-semibold ${payerId === m.id ? 'text-white' : 'text-slate-700'}`}>
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={tw`text-sm font-bold text-slate-700 mb-2`}>Category</Text>
        <View style={tw`flex-row flex-wrap mb-2`}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              style={tw`px-3 py-2 rounded-xl border mr-2 mb-2 ${category === cat.id ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-100'}`}
            >
              <Text style={tw`text-xs font-bold ${category === cat.id ? 'text-indigo-600' : 'text-slate-500'}`}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Split Mechanism */}
      <View style={tw`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6`}>
        <Text style={tw`text-base font-bold text-slate-800 mb-3`}>Split Method</Text>
        
        {/* Split Type Tabs */}
        <View style={tw`flex-row bg-slate-100 p-1 rounded-xl mb-4`}>
          {(['equal', 'percentage', 'exact', 'shares'] as const).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => setSplitType(type)}
              style={tw`flex-1 py-2 rounded-lg items-center ${splitType === type ? 'bg-white shadow-xs' : ''}`}
            >
              <Text style={tw`text-xs font-semibold capitalize ${splitType === type ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Validation details */}
        {numAmount > 0 ? (
          <View style={tw`flex-row items-center bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100`}>
            <Info size={14} color="#4f46e5" style={tw`mr-2`} />
            <Text style={tw`text-xs font-medium ${stats.isValid ? 'text-green-600' : 'text-indigo-600'}`}>
              {stats.text}
            </Text>
          </View>
        ) : null}

        {/* Member Input Fields */}
        <Text style={tw`text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider`}>Split Breakup</Text>
        {members.map(m => {
          if (splitType === 'equal') {
            const isIncluded = includedMembers[m.id];
            const perPersonShare = numAmount / Math.max(1, Object.values(includedMembers).filter(Boolean).length);
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => toggleEqualMember(m.id)}
                style={tw`flex-row items-center justify-between py-3 border-b border-slate-100`}
              >
                <View style={tw`flex-row items-center`}>
                  <View style={tw`w-5 h-5 rounded border items-center justify-center mr-3 ${isIncluded ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                    {isIncluded ? <Check color="white" size={12} /> : null}
                  </View>
                  <Text style={tw`font-semibold text-slate-800 ${!isIncluded ? 'text-slate-400 line-through' : ''}`}>
                    {m.name}
                  </Text>
                </View>
                {isIncluded && numAmount > 0 ? (
                  <Text style={tw`font-bold text-slate-600`}>₹{perPersonShare.toFixed(2)}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }

          // Unequal splits inputs
          let suffix = '';
          if (splitType === 'percentage') suffix = '%';
          if (splitType === 'exact') suffix = '₹';
          if (splitType === 'shares') suffix = 'shares';

          // Show calculated value if percentage or shares
          let calculatedAmt = 0;
          if (numAmount > 0) {
            const val = parseFloat(splitValues[m.id]) || 0;
            if (splitType === 'percentage') {
              calculatedAmt = (numAmount * val) / 100;
            } else if (splitType === 'shares') {
              const totalShares = Object.values(splitValues).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
              calculatedAmt = totalShares > 0 ? (numAmount * val) / totalShares : 0;
            }
          }

          return (
            <View key={m.id} style={tw`flex-row items-center justify-between py-2.5 border-b border-slate-100`}>
              <View style={tw`flex-1`}>
                <Text style={tw`font-semibold text-slate-800`}>{m.name}</Text>
                {calculatedAmt > 0 && (splitType === 'percentage' || splitType === 'shares') ? (
                  <Text style={tw`text-slate-400 text-xs mt-0.5`}>Calculated: ₹{calculatedAmt.toFixed(2)}</Text>
                ) : null}
              </View>
              <View style={tw`flex-row items-center`}>
                <TextInput
                  value={splitValues[m.id]}
                  onChangeText={(text) => handleSplitValueChange(m.id, text)}
                  placeholder="0"
                  placeholderTextColor="#cbd5e1"
                  keyboardType="numeric"
                  style={tw`border border-slate-200 rounded-lg px-2.5 py-1.5 text-right font-semibold text-slate-800 bg-slate-50 w-24 mr-2`}
                />
                <Text style={tw`text-slate-400 font-semibold text-sm w-12`}>{suffix}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        style={tw`bg-indigo-600 py-3.5 rounded-xl items-center shadow-sm`}
      >
        <Text style={tw`text-white font-bold text-base`}>Save Expense</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
