import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Share, TextInput, Alert, ActivityIndicator, StatusBar, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from 'twrnc';
import { Wallet, Plus, Calendar, History, Settings, LogOut, Users, Share2 } from 'lucide-react-native';
import { subscribeToGroup, saveGroup, Group, RecurringExpenseRule } from './src/utils/db';
import { Member, Expense, Settlement } from './src/utils/debtSimplifier';

// Components
import GroupSelector from './src/components/GroupSelector';
import LedgerView from './src/components/LedgerView';
import ExpenseForm from './src/components/ExpenseForm';
import ExpenseHistory from './src/components/ExpenseHistory';
import RecurringExpenses from './src/components/RecurringExpenses';

const STORAGE_IDENTITY_KEY = '@SplitSmart:current_member_id_for_';

export default function App() {
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'add' | 'history' | 'recurring' | 'settings'>('ledger');
  const [loading, setLoading] = useState(false);
  
  // Settings view inputs
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberUpi, setNewMemberUpi] = useState('');

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time updates when a group is selected
  useEffect(() => {
    if (!currentGroup) return;

    // Clean up existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Subscribe to database
    unsubscribeRef.current = subscribeToGroup(currentGroup.id, (updatedGroup: Group | null) => {
      if (updatedGroup) {
        // Auto-run recurring scheduler check silently on sync
        const processedGroup = checkAndTriggerRecurring(updatedGroup);
        
        // If scheduler added expenses, save back to sync DB
        if (JSON.stringify(processedGroup) !== JSON.stringify(updatedGroup)) {
          saveGroup(processedGroup);
        } else {
          setCurrentGroup(updatedGroup);
        }
      }
    });

    // Load user identity for this group
    AsyncStorage.getItem(STORAGE_IDENTITY_KEY + currentGroup.id).then(id => {
      setCurrentMemberId(id);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [currentGroup?.id]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const handleGroupSelected = async (group: Group) => {
    setLoading(true);
    // Cache group selection
    setCurrentGroup(group);
    
    // Auto-detect identity (if user is first/only member, set them as current)
    const storedIdentity = await AsyncStorage.getItem(STORAGE_IDENTITY_KEY + group.id);
    if (!storedIdentity && group.members.length > 0) {
      const firstMemberId = group.members[0].id;
      await AsyncStorage.setItem(STORAGE_IDENTITY_KEY + group.id, firstMemberId);
      setCurrentMemberId(firstMemberId);
    } else {
      setCurrentMemberId(storedIdentity);
    }
    setLoading(false);
  };

  const handleAddExpense = async (expenseData: Omit<Expense, 'id' | 'date'>) => {
    if (!currentGroup) return;

    const newExpense: Expense = {
      ...expenseData,
      id: 'e-' + Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
    };

    const updatedGroup: Group = {
      ...currentGroup,
      expenses: [...currentGroup.expenses, newExpense],
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
    setActiveTab('ledger'); // Jump back to ledger
  };

  const handleEditExpense = async (updatedExpense: Expense) => {
    if (!currentGroup) return;

    const updatedGroup: Group = {
      ...currentGroup,
      expenses: currentGroup.expenses.map((e: Expense) => e.id === updatedExpense.id ? updatedExpense : e),
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
    setActiveTab('history');
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!currentGroup) return;

    const updatedGroup: Group = {
      ...currentGroup,
      expenses: currentGroup.expenses.filter((e: Expense) => e.id !== expenseId),
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
  };

  const handleAddSettlement = async (settlementData: Omit<Settlement, 'id' | 'date'>) => {
    if (!currentGroup) return;

    const newSettlement: Settlement = {
      ...settlementData,
      id: 's-' + Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
    };

    const updatedGroup: Group = {
      ...currentGroup,
      settlements: [...currentGroup.settlements, newSettlement],
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
  };

  const handleConfirmSettlement = async (settlementId: string) => {
    if (!currentGroup) return;

    const updatedGroup: Group = {
      ...currentGroup,
      settlements: currentGroup.settlements.map((s: Settlement) => {
        if (s.id === settlementId) {
          return { ...s, status: 'settled' };
        }
        return s;
      }),
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
  };

  const handleDeclineSettlement = async (settlementId: string) => {
    if (!currentGroup) return;

    // Declining deletes the settlement request
    const updatedGroup: Group = {
      ...currentGroup,
      settlements: currentGroup.settlements.filter((s: Settlement) => s.id !== settlementId),
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
  };

  const handleAddRecurringRule = async (ruleData: Omit<RecurringExpenseRule, 'id' | 'lastTriggeredDate'>) => {
    if (!currentGroup) return;

    const newRule: RecurringExpenseRule = {
      ...ruleData,
      id: 'r-' + Date.now().toString(),
    };

    const updatedGroup: Group = {
      ...currentGroup,
      recurringExpenses: [...currentGroup.recurringExpenses, newRule],
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
  };

  const handleDeleteRecurringRule = async (ruleId: string) => {
    if (!currentGroup) return;

    const updatedGroup: Group = {
      ...currentGroup,
      recurringExpenses: currentGroup.recurringExpenses.filter((r: RecurringExpenseRule) => r.id !== ruleId),
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
  };

  const handleTriggerManualCheck = async () => {
    if (!currentGroup) return;
    const processed = checkAndTriggerRecurring(currentGroup);
    if (JSON.stringify(processed) !== JSON.stringify(currentGroup)) {
      await saveGroup(processed);
      setCurrentGroup(processed);
    }
  };

  const handleAddMemberManually = async () => {
    if (!currentGroup) return;
    if (!newMemberName.trim() || !newMemberUpi.trim()) {
      Alert.alert('Error', 'Please fill in both name and UPI ID.');
      return;
    }
    if (!newMemberUpi.includes('@')) {
      Alert.alert('Error', 'Please enter a valid UPI ID (e.g. name@upi).');
      return;
    }

    const newMember: Member = {
      id: 'm-' + Date.now().toString(),
      name: newMemberName.trim(),
      upiId: newMemberUpi.trim(),
    };

    const updatedGroup: Group = {
      ...currentGroup,
      members: [...currentGroup.members, newMember],
    };

    await saveGroup(updatedGroup);
    setCurrentGroup(updatedGroup);
    setNewMemberName('');
    setNewMemberUpi('');
    Alert.alert('Success', `Added ${newMember.name} to the group.`);
  };

  const handleSetIdentity = async (memberId: string) => {
    if (!currentGroup) return;
    await AsyncStorage.setItem(STORAGE_IDENTITY_KEY + currentGroup.id, memberId);
    setCurrentMemberId(memberId);
  };

  const handleShareGroup = async () => {
    if (!currentGroup) return;
    try {
      await Share.share({
        message: `Join my SplitSmart expense group: "${currentGroup.name}". Invite Code: ${currentGroup.id}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to close this view? You can re-enter this group using the invite code "${currentGroup?.id}" anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (unsubscribeRef.current) unsubscribeRef.current();
            setCurrentGroup(null);
            setCurrentMemberId(null);
            setActiveTab('ledger');
          },
        },
      ]
    );
  };

  /**
   * Evaluates recurring expense rules and triggers back-postings.
   */
  const checkAndTriggerRecurring = (group: Group): Group => {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);
    let groupUpdated = false;
    const updatedExpenses = [...group.expenses];
    
    const updatedRules = group.recurringExpenses.map((rule: RecurringExpenseRule) => {
      let lastDateStr = rule.lastTriggeredDate;
      if (!lastDateStr) {
        // Set yesterday as default starting date to avoid logging old historical items
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        lastDateStr = yesterday.toISOString().split('T')[0];
      }

      let checkDate = new Date(lastDateStr);
      checkDate.setDate(checkDate.getDate() + 1); // start checking the day after last trigger

      while (checkDate <= today) {
        const checkDateStr = checkDate.toISOString().split('T')[0];
        let shouldTrigger = false;

        if (rule.frequency === 'monthly') {
          const targetDay = rule.dayOfMonth || 1;
          const currentDay = checkDate.getDate();
          
          // Handle shorter months (e.g. target is 31, but Feb has 28)
          const daysInMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0).getDate();
          const adjustedTarget = Math.min(targetDay, daysInMonth);

          if (currentDay === adjustedTarget) {
            shouldTrigger = true;
          }
        } else if (rule.frequency === 'weekly') {
          const targetDayOfWeek = rule.dayOfWeek ?? 0;
          if (checkDate.getDay() === targetDayOfWeek) {
            shouldTrigger = true;
          }
        }

        if (shouldTrigger) {
          updatedExpenses.push({
            id: `e-recur-${rule.id}-${checkDateStr}`,
            description: `${rule.description} (Auto-posted)`,
            amount: rule.amount,
            payerId: rule.payerId,
            category: rule.category,
            date: checkDateStr,
            splitType: rule.splitType,
            splits: rule.splits,
            excludedMemberIds: rule.excludedMemberIds,
          });
          lastDateStr = checkDateStr;
          groupUpdated = true;
        }

        checkDate.setDate(checkDate.getDate() + 1);
      }

      return {
        ...rule,
        lastTriggeredDate: lastDateStr,
      };
    });

    if (groupUpdated) {
      return {
        ...group,
        expenses: updatedExpenses,
        recurringExpenses: updatedRules,
      };
    }
    return group;
  };

  if (loading) {
    return (
      <SafeAreaView style={tw`flex-1 justify-center items-center bg-slate-50`}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  // Render selector if no active group
  if (!currentGroup) {
    return (
      <SafeAreaView style={tw`flex-1 bg-slate-50`}>
        <StatusBar barStyle="dark-content" />
        <GroupSelector onGroupSelected={handleGroupSelected} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`}>
      <StatusBar barStyle="dark-content" />
      
      {/* Group Header Info */}
      <View style={tw`bg-white px-5 py-4 border-b border-slate-100 flex-row justify-between items-center shadow-xs`}>
        <View style={tw`flex-1`}>
          <Text style={tw`text-lg font-black text-slate-800`}>{currentGroup.name}</Text>
          <TouchableOpacity onPress={handleShareGroup} style={tw`flex-row items-center mt-1`}>
            <Text style={tw`text-slate-400 text-xs font-semibold mr-1`}>Code: {currentGroup.id}</Text>
            <Share2 size={11} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLeaveGroup} style={tw`bg-slate-100 px-3 py-2 rounded-xl flex-row items-center border border-slate-200`}>
          <LogOut size={12} color="#dc2626" style={tw`mr-1`} />
          <Text style={tw`text-red-600 text-xs font-bold`}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab Render */}
      <View style={tw`flex-1`}>
        {activeTab === 'ledger' && (
          <LedgerView
            group={currentGroup}
            currentMemberId={currentMemberId}
            onAddSettlement={handleAddSettlement}
            onConfirmSettlement={handleConfirmSettlement}
            onDeclineSettlement={handleDeclineSettlement}
          />
        )}
        
        {activeTab === 'add' && (
          <ExpenseForm
            members={currentGroup.members}
            onAddExpense={handleAddExpense}
            onCancel={() => setActiveTab('ledger')}
          />
        )}

        {activeTab === 'history' && (
          <ExpenseHistory
            group={currentGroup}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringExpenses
            group={currentGroup}
            onAddRule={handleAddRecurringRule}
            onDeleteRule={handleDeleteRecurringRule}
            onTriggerCheck={handleTriggerManualCheck}
          />
        )}

        {activeTab === 'settings' && (
          <ScrollView contentContainerStyle={tw`p-5 pb-16 bg-slate-50`}>
            {/* Identity Settings */}
            <View style={tw`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-5`}>
              <Text style={tw`text-base font-bold text-slate-800 mb-2`}>Who are you in this group?</Text>
              <Text style={tw`text-xs text-slate-400 mb-4 leading-relaxed`}>
                Selecting your identity allows SplitSmart to display personalized calculations like "You owe" or "Rahul owes you".
              </Text>
              <View style={tw`flex-row flex-wrap`}>
                {currentGroup.members.map((m: Member) => {
                  const isSelected = m.id === currentMemberId;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => handleSetIdentity(m.id)}
                      style={tw`px-3 py-2 border rounded-xl mr-2 mb-2 ${isSelected ? 'bg-indigo-50 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <Text style={tw`text-xs font-bold ${isSelected ? 'text-indigo-600 font-bold' : 'text-slate-600'}`}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Add Member Manually */}
            <View style={tw`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-5`}>
              <Text style={tw`text-base font-bold text-slate-800 mb-1`}>Add Roommate / Friend</Text>
              <Text style={tw`text-xs text-slate-400 mb-4`}>Add members manually for roommates who don't have the app yet.</Text>

              <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Friend's Name</Text>
              <TextInput
                value={newMemberName}
                onChangeText={setNewMemberName}
                placeholder="e.g. Gaurav Kapoor"
                placeholderTextColor="#94a3b8"
                style={tw`border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 bg-slate-50 mb-3 text-sm`}
              />

              <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Friend's UPI ID</Text>
              <TextInput
                value={newMemberUpi}
                onChangeText={setNewMemberUpi}
                placeholder="e.g. gaurav@okhdfc"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                style={tw`border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 bg-slate-50 mb-4 text-sm`}
              />

              <TouchableOpacity
                onPress={handleAddMemberManually}
                style={tw`bg-indigo-600 py-3 rounded-xl items-center flex-row justify-center`}
              >
                <Users color="white" size={14} style={tw`mr-1.5`} />
                <Text style={tw`text-white font-bold text-sm`}>Add to Group</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom Navigation Tab Bar */}
      <View style={tw`flex-row justify-around bg-white border-t border-slate-200 py-2.5 shadow-sm`}>
        <TouchableOpacity
          onPress={() => setActiveTab('ledger')}
          style={tw`items-center justify-center flex-1`}
        >
          <Wallet size={20} color={activeTab === 'ledger' ? '#4f46e5' : '#94a3b8'} />
          <Text style={tw`text-[10px] font-bold mt-1 ${activeTab === 'ledger' ? 'text-indigo-600' : 'text-slate-400'}`}>
            Ledger
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setActiveTab('add')}
          style={tw`items-center justify-center flex-1`}
        >
          <View style={tw`w-10 h-10 bg-indigo-600 rounded-full items-center justify-center -mt-5 shadow-md`}>
            <Plus size={20} color="white" />
          </View>
          <Text style={tw`text-[10px] font-bold mt-1 ${activeTab === 'add' ? 'text-indigo-600' : 'text-slate-400'}`}>
            Log Split
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          style={tw`items-center justify-center flex-1`}
        >
          <History size={20} color={activeTab === 'history' ? '#4f46e5' : '#94a3b8'} />
          <Text style={tw`text-[10px] font-bold mt-1 ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400'}`}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('recurring')}
          style={tw`items-center justify-center flex-1`}
        >
          <Calendar size={20} color={activeTab === 'recurring' ? '#4f46e5' : '#94a3b8'} />
          <Text style={tw`text-[10px] font-bold mt-1 ${activeTab === 'recurring' ? 'text-indigo-600' : 'text-slate-400'}`}>
            Recurring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('settings')}
          style={tw`items-center justify-center flex-1`}
        >
          <Settings size={20} color={activeTab === 'settings' ? '#4f46e5' : '#94a3b8'} />
          <Text style={tw`text-[10px] font-bold mt-1 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-400'}`}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
