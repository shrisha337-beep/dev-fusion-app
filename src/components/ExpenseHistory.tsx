import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import tw from 'twrnc';
import { Search, Download, Trash2, Edit3, Calendar } from 'lucide-react-native';
import { Member, Expense, SplitType } from '../utils/debtSimplifier';
import { exportToCSV, exportToPDF } from '../utils/exporter';
import { Group } from '../utils/db';

interface ExpenseHistoryProps {
  group: Group;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'food', label: 'Food' },
  { id: 'travel', label: 'Travel' },
  { id: 'rent', label: 'Rent' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'other', label: 'Other' },
] as const;

export default function ExpenseHistory({ group, onEditExpense, onDeleteExpense }: ExpenseHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'all' | 'month' | 'week'>('all');

  const memberMap = new Map<string, Member>();
  group.members.forEach(m => memberMap.set(m.id, m));

  // Filter Logic
  const filteredExpenses = group.expenses.filter(e => {
    // 1. Text Search (description or payer name)
    const payerName = memberMap.get(e.payerId)?.name || 'Unknown';
    const matchesText =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payerName.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Category Filter
    const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;

    // 3. Timeframe Filter
    let matchesTime = true;
    if (timeframe === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      matchesTime = new Date(e.date) >= oneMonthAgo;
    } else if (timeframe === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      matchesTime = new Date(e.date) >= oneWeekAgo;
    }

    return matchesText && matchesCategory && matchesTime;
  });

  // Sort descending by date
  const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDeletePress = (id: string, description: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteExpense(id),
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    try {
      await exportToCSV(group);
    } catch (e) {
      Alert.alert('Export Failed', 'Unable to export CSV file.');
      console.error(e);
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(group);
    } catch (e) {
      Alert.alert('Export Failed', 'Unable to export PDF file.');
      console.error(e);
    }
  };

  // Helper to color category badge
  const getCatColor = (cat: Expense['category']) => {
    switch (cat) {
      case 'food': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'travel': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'rent': return 'bg-emerald-50 text-green-600 border-emerald-100';
      case 'utilities': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'entertainment': return 'bg-pink-50 text-pink-600 border-pink-100';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* 1. Header Toolbar */}
      <View style={tw`p-5 bg-white border-b border-slate-100 shadow-sm`}>
        {/* Title and Exporters */}
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <Text style={tw`text-xl font-bold text-slate-800`}>Expense History</Text>
          <View style={tw`flex-row`}>
            <TouchableOpacity
              onPress={handleExportCSV}
              style={tw`flex-row items-center bg-slate-100 px-3 py-2 rounded-xl mr-2`}
            >
              <Download size={14} color="#475569" style={tw`mr-1.5`} />
              <Text style={tw`text-slate-700 text-xs font-bold`}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExportPDF}
              style={tw`flex-row items-center bg-indigo-50 px-3 py-2 rounded-xl`}
            >
              <Download size={14} color="#4f46e5" style={tw`mr-1.5`} />
              <Text style={tw`text-indigo-700 text-xs font-bold`}>PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Input */}
        <View style={tw`flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-4`}>
          <Search size={16} color="#94a3b8" style={tw`mr-2`} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by description or payer..."
            placeholderTextColor="#94a3b8"
            style={tw`flex-1 text-slate-800 text-sm p-0`}
          />
        </View>

        {/* Timeframe selector */}
        <View style={tw`flex-row bg-slate-100 p-0.5 rounded-lg mb-3`}>
          {(['all', 'month', 'week'] as const).map(tf => (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeframe(tf)}
              style={tw`flex-1 py-1.5 rounded-md items-center ${timeframe === tf ? 'bg-white shadow-xs' : ''}`}
            >
              <Text style={tw`text-xs font-semibold ${timeframe === tf ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>
                {tf === 'all' ? 'All Time' : tf === 'month' ? 'Last Month' : 'Last Week'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Horizontal Category Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-1`}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={tw`px-3.5 py-1.5 rounded-full border mr-2 ${selectedCategory === cat.id ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
            >
              <Text style={tw`text-xs font-semibold ${selectedCategory === cat.id ? 'text-white' : 'text-slate-600'}`}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 2. Scrollable Expenses List */}
      <ScrollView contentContainerStyle={tw`p-5 pb-16`}>
        {sortedExpenses.length === 0 ? (
          <View style={tw`bg-white border border-slate-100 p-8 rounded-2xl items-center shadow-xs`}>
            <Text style={tw`text-slate-400 font-semibold text-sm`}>No expenses found</Text>
            <Text style={tw`text-slate-300 text-xs mt-1`}>Try modifying your search or filter pills.</Text>
          </View>
        ) : (
          sortedExpenses.map(e => {
            const payerName = memberMap.get(e.payerId)?.name || 'Unknown';
            return (
              <View
                key={e.id}
                style={tw`bg-white p-4 rounded-2xl border border-slate-100 mb-3.5 shadow-sm flex-row justify-between items-center`}
              >
                <View style={tw`flex-1 pr-3`}>
                  <View style={tw`flex-row items-center mb-1.5`}>
                    <Text style={tw`font-extrabold text-slate-800 text-base mr-2`}>{e.description}</Text>
                    <View style={tw`px-2.5 py-0.5 rounded-full border ${getCatColor(e.category)}`}>
                      <Text style={tw`text-[10px] font-bold uppercase tracking-wider`}>{e.category}</Text>
                    </View>
                  </View>

                  <Text style={tw`text-slate-500 text-xs font-medium`}>
                    Paid by <Text style={tw`font-bold text-slate-600`}>{payerName}</Text> • Split: {e.splitType}
                  </Text>
                  
                  <View style={tw`flex-row items-center mt-2.5`}>
                    <Calendar size={12} color="#94a3b8" style={tw`mr-1`} />
                    <Text style={tw`text-slate-400 text-[10px] font-semibold`}>
                      {new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>

                {/* Amount and edit/delete actions */}
                <View style={tw`items-end`}>
                  <Text style={tw`text-lg font-black text-slate-900 mb-2`}>₹{e.amount.toFixed(2)}</Text>
                  
                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      onPress={() => onEditExpense(e)}
                      style={tw`w-8 h-8 bg-slate-100 rounded-full items-center justify-center mr-2 border border-slate-200 shadow-xs`}
                    >
                      <Edit3 size={13} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePress(e.id, e.description)}
                      style={tw`w-8 h-8 bg-red-50 rounded-full items-center justify-center border border-red-100 shadow-xs`}
                    >
                      <Trash2 size={13} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
